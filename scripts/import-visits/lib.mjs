// Past-visits importer: checks a past_visits.json file and turns it into
// one SQL script for the Supabase SQL editor. Pure functions, no database
// access, so it is easy to test (tests/import-visits.test.ts).
// Format: see the format_version 1 description in README.md.

// Allowed values. A test checks these match the database enums.
export const HUBS = ["Darmstadt", "Mainz"];
export const CONDITIONS = ["clean", "minor_dust", "dusty", "mould", "damaged"];
export const SEVERITIES = ["low", "medium", "high", "immediate"];
export const UPDATE_STATES = ["new", "still_open", "improved", "resolved"];
export const STAFF_ROLES = ["picker", "rider", "shift_lead", "manager", "other"];
export const CATEGORIES = [
  "ac_leaks",
  "app_routing",
  "batteries_chargers",
  "bike_room",
  "floor",
  "fridge_freezer_equipment",
  "other",
  "process",
  "rider_safety_gear",
  "riders_room",
  "shelf_hygiene",
  "staff_welfare",
  "water_filter",
];

// Keys that would hold a person's name. CLAUDE.md: never store staff names.
const NAME_KEYS = /^(name|first_?name|last_?name|full_?name|staff_?name|employee_?name)$/i;

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isText = (v) => typeof v === "string";
const optText = (v) => v === undefined || v === null || isText(v);
const optBool = (v) => v === undefined || v === null || typeof v === "boolean";
const isDate = (v) =>
  isText(v) && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

// "12" -> [12]; "1-8" -> [1..8]; anything else -> null
export function expandShelves(text) {
  const m = /^\s*(\d+)\s*(?:-\s*(\d+)\s*)?$/.exec(String(text));
  if (!m) return null;
  const from = Number(m[1]);
  const to = m[2] ? Number(m[2]) : from;
  if (from < 1 || to < from) return null;
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

// Checks the whole file. Returns { errors: string[], data } where data is
// the normalised content, ready for toSql(). Nothing is imported if there
// is a single error.
export function validate(json) {
  const errors = [];
  const err = (where, msg) => errors.push(`${where}: ${msg}`);

  if (!isObject(json)) return { errors: ["The file must contain one JSON object."], data: null };
  if (json.format_version !== 1) err("format_version", "must be 1");
  if (!Array.isArray(json.visits)) err("visits", "must be a list");
  if (!Array.isArray(json.issues)) err("issues", "must be a list");
  if (errors.length) return { errors, data: null };

  // Refuse anything that looks like a person's name, anywhere.
  (function scan(value, path) {
    if (Array.isArray(value)) value.forEach((v, i) => scan(v, `${path}[${i}]`));
    else if (isObject(value)) {
      for (const [k, v] of Object.entries(value)) {
        if (NAME_KEYS.test(k)) err(`${path}.${k}`, "names must not be stored (role and tenure only)");
        scan(v, `${path}.${k}`);
      }
    }
  })(json, "file");

  const visits = [];
  const visitByKey = new Map();
  const hubNumbers = new Set();

  json.visits.forEach((v, i) => {
    const at = `visits[${i}]${isObject(v) && isText(v.visit_key) ? ` (${v.visit_key})` : ""}`;
    if (!isObject(v)) return err(at, "must be an object");
    if (!isText(v.visit_key) || !v.visit_key.trim()) err(at, "visit_key is required");
    else if (visitByKey.has(v.visit_key)) err(at, `visit_key "${v.visit_key}" is used twice`);
    if (!HUBS.includes(v.hub)) err(at, `hub must be one of ${HUBS.join(", ")}`);
    if (!Number.isInteger(v.visit_number) || v.visit_number < 1)
      err(at, "visit_number must be a whole number of 1 or more");
    else if (HUBS.includes(v.hub)) {
      const key = `${v.hub}#${v.visit_number}`;
      if (hubNumbers.has(key)) err(at, `${v.hub} visit_number ${v.visit_number} is used twice`);
      hubNumbers.add(key);
    }
    if (!isDate(v.visit_date)) err(at, "visit_date must be a date like 2026-09-18");
    if (!optBool(v.date_is_placeholder)) err(at, "date_is_placeholder must be true or false");
    if (!optBool(v.manager_present)) err(at, "manager_present must be true, false or null");
    for (const f of ["label", "overall_impression", "notes"]) {
      if (!optText(v[f])) err(at, `${f} must be text`);
    }

    const checks = [];
    const seenShelves = new Set();
    (v.shelf_checks ?? []).forEach((c, j) => {
      const cat = `${at}.shelf_checks[${j}]`;
      if (!isObject(c)) return err(cat, "must be an object");
      const numbers = expandShelves(c.shelves);
      if (!numbers) err(cat, `shelves "${c.shelves}" must be a number like "12" or a range like "1-8"`);
      if (!CONDITIONS.includes(c.condition)) err(cat, `condition must be one of ${CONDITIONS.join(", ")}`);
      const score = c.score_5 ?? null;
      if (score !== null && !(typeof score === "number" && score >= 0 && score <= 5 && Math.round(score * 100) === score * 100))
        err(cat, "score_5 must be a number from 0 to 5 (max 2 decimals) or null");
      if (!optText(c.comment)) err(cat, "comment must be text");
      for (const n of numbers ?? []) {
        if (seenShelves.has(n)) err(cat, `shelf ${n} is checked twice in this visit`);
        seenShelves.add(n);
        checks.push({ shelf: n, condition: c.condition, score, comment: c.comment?.trim() || null });
      }
    });

    const feedback = [];
    (v.staff_feedback ?? []).forEach((f, j) => {
      const fat = `${at}.staff_feedback[${j}]`;
      if (!isObject(f)) return err(fat, "must be an object");
      if (!STAFF_ROLES.includes(f.staff_role)) err(fat, `staff_role must be one of ${STAFF_ROLES.join(", ")}`);
      if (!optBool(f.returning)) err(fat, "returning must be true or false");
      if (!optText(f.tenure_note) || !optText(f.points)) err(fat, "tenure_note and points must be text");
      const topics = f.topics ?? [];
      if (!Array.isArray(topics) || !topics.every((t) => isText(t) && /^[\p{L}\p{N}_]+$/u.test(t)))
        err(fat, "topics must be a list of snake_case tags");
      feedback.push({
        role: f.staff_role,
        returning: f.returning ?? false,
        tenure: f.tenure_note?.trim() || null,
        points: f.points?.trim() || null,
        topics: Array.isArray(topics) ? topics : [],
      });
    });

    const visit = {
      key: v.visit_key,
      hub: v.hub,
      number: v.visit_number,
      date: v.visit_date,
      placeholder: v.date_is_placeholder ?? false,
      label: v.label?.trim() || `Visit ${v.visit_number}`,
      managerPresent: v.manager_present ?? null,
      impression: v.overall_impression?.trim() || null,
      notes: v.notes?.trim() || null,
      checks,
      feedback,
    };
    if (isText(v.visit_key) && !visitByKey.has(v.visit_key)) visitByKey.set(v.visit_key, visit);
    visits.push(visit);
  });

  const issues = [];
  const issueKeys = new Set();
  json.issues.forEach((issue, i) => {
    const at = `issues[${i}]${isObject(issue) && isText(issue.issue_key) ? ` (${issue.issue_key})` : ""}`;
    if (!isObject(issue)) return err(at, "must be an object");
    if (!isText(issue.issue_key) || !issue.issue_key.trim()) err(at, "issue_key is required");
    else if (issueKeys.has(issue.issue_key)) err(at, `issue_key "${issue.issue_key}" is used twice`);
    issueKeys.add(issue.issue_key);
    if (!HUBS.includes(issue.hub)) err(at, `hub must be one of ${HUBS.join(", ")}`);
    if (!CATEGORIES.includes(issue.category)) err(at, `category must be one of ${CATEGORIES.join(", ")}`);
    if (!SEVERITIES.includes(issue.severity)) err(at, `severity must be one of ${SEVERITIES.join(", ")}`);
    if (!isText(issue.title) || !issue.title.trim()) err(at, "title is required");
    if (!optText(issue.description)) err(at, "description must be text");
    if (!optBool(issue.exclude_from_outputs)) err(at, "exclude_from_outputs must be true or false");
    if (!Array.isArray(issue.updates) || issue.updates.length === 0)
      return err(at, "updates must be a list with at least one update");

    const updates = [];
    const seenVisits = new Set();
    issue.updates.forEach((u, j) => {
      const uat = `${at}.updates[${j}]`;
      if (!isObject(u)) return err(uat, "must be an object");
      const visit = visitByKey.get(u.visit_key);
      if (!visit) return err(uat, `visit_key "${u.visit_key}" not found in visits`);
      if (visit.hub !== issue.hub) err(uat, `visit ${u.visit_key} is at ${visit.hub}, but the issue is at ${issue.hub}`);
      if (seenVisits.has(u.visit_key)) err(uat, `two updates for visit ${u.visit_key}`);
      seenVisits.add(u.visit_key);
      if (!UPDATE_STATES.includes(u.state)) err(uat, `state must be one of ${UPDATE_STATES.join(", ")}`);
      if (!optText(u.note)) err(uat, "note must be text");
      updates.push({ visitKey: u.visit_key, date: visit.date, number: visit.number, state: u.state, note: u.note?.trim() || null });
    });
    updates.sort((a, b) => a.date.localeCompare(b.date) || a.number - b.number);

    if (updates.length) {
      if (updates[0].state !== "new") err(at, `the first update (visit ${updates[0].visitKey}) must be "new"`);
      updates.slice(1).forEach((u) => {
        if (u.state === "new") err(at, `only the first update can be "new" (visit ${u.visitKey})`);
      });
    }
    const last = updates[updates.length - 1];
    issues.push({
      key: issue.issue_key,
      hub: issue.hub,
      category: issue.category,
      severity: issue.severity,
      title: issue.title?.trim(),
      description: issue.description?.trim() || null,
      excluded: issue.exclude_from_outputs ?? false,
      status: last?.state === "resolved" ? "resolved" : "open",
      firstVisitKey: updates[0]?.visitKey ?? null,
      resolvedVisitKey: last?.state === "resolved" ? last.visitKey : null,
      updates,
    });
  });

  return errors.length ? { errors, data: null } : { errors, data: { visits, issues } };
}

// ---- SQL ------------------------------------------------------------------

const lit = (v) => {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  return `'${String(v).replaceAll("'", "''")}'`;
};
const arr = (list) => (list.length ? `array[${list.map(lit).join(", ")}]::text[]` : "'{}'::text[]");
const rows = (list) => list.map((r) => `  (${r.join(", ")})`).join(",\n");

// One SQL script: all or nothing, safe to run twice (existing visits and
// issues are skipped), ends by showing how many rows were added per table.
export function toSql(data, inspectorEmail) {
  const checks = data.visits.flatMap((v) =>
    v.checks.map((c) => [lit(v.key), c.shelf, lit(c.condition), lit(c.score), lit(c.comment)]),
  );
  const feedback = data.visits.flatMap((v) =>
    v.feedback.map((f) => [lit(v.key), lit(f.role), lit(f.returning), lit(f.tenure), lit(f.points), arr(f.topics)]),
  );
  const updates = data.issues.flatMap((i) =>
    i.updates.map((u) => [lit(i.key), lit(u.visitKey), lit(u.state), lit(u.note)]),
  );

  const parts = [];
  parts.push(`-- Generated by scripts/import-visits (HubCheck past-visits importer).
-- Paste into the Supabase SQL editor and run. All or nothing; safe to run
-- twice (visits with the same hub + number and issues with the same
-- issue_key are skipped). The last result shows rows added per table.
-- Run it in one go: the editor then treats the whole script as a single
-- transaction, so any error undoes everything.

create temp table _counts_before on commit drop as
select (select count(*) from public.visits) as visits,
       (select count(*) from public.shelf_checks) as shelf_checks,
       (select count(*) from public.staff_feedback) as staff_feedback,
       (select count(*) from public.issues) as issues,
       (select count(*) from public.issue_updates) as issue_updates;

-- The inspector the visits are recorded under.
create temp table _inspector on commit drop as
select p.id from public.profiles p join auth.users u on u.id = p.id
where lower(u.email) = lower(${lit(inspectorEmail)});

do $$ begin
  if not exists (select 1 from _inspector) then
    raise exception 'No HubCheck user with email %. Log in once (or add the user) first.', ${lit(inspectorEmail)};
  end if;
end $$;`);

  parts.push(`
-- Visits from the file.
create temp table _visits (
  visit_key text primary key, hub text, visit_number int, visit_date date,
  date_is_placeholder boolean, label text, manager_present boolean,
  overall_impression text, notes text
) on commit drop;
insert into _visits values
${rows(data.visits.map((v) => [lit(v.key), lit(v.hub), v.number, `${lit(v.date)}::date`, lit(v.placeholder), lit(v.label), lit(v.managerPresent), lit(v.impression), lit(v.notes)]))};

do $$ begin
  if exists (select 1 from _visits v left join public.hubs h on h.name = v.hub where h.id is null) then
    raise exception 'A hub in the file does not exist in the database. Run the seed migration first.';
  end if;
end $$;

-- Insert visits that don't exist yet (hub + visit number), as submitted.
create temp table _new_visits (visit_key text, id uuid) on commit drop;
with inserted as (
  insert into public.visits
    (hub_id, inspector_id, visit_date, date_is_placeholder, visit_number, label,
     manager_present, overall_impression, notes, status, current_step, submitted_at)
  select h.id, (select id from _inspector), v.visit_date, v.date_is_placeholder, v.visit_number,
         v.label, v.manager_present, v.overall_impression, v.notes, 'submitted', 'summary', now()
  from _visits v join public.hubs h on h.name = v.hub
  where not exists (
    select 1 from public.visits x where x.hub_id = h.id and x.visit_number = v.visit_number
  )
  returning id, hub_id, visit_number
)
insert into _new_visits
select v.visit_key, i.id
from inserted i join public.hubs h on h.id = i.hub_id
join _visits v on v.hub = h.name and v.visit_number = i.visit_number;

-- Every visit in the file, new or already there.
create temp table _visit_ids on commit drop as
select v.visit_key, x.id, h.id as hub_id
from _visits v join public.hubs h on h.name = v.hub
join public.visits x on x.hub_id = h.id and x.visit_number = v.visit_number;`);

  if (checks.length) {
    parts.push(`
-- Shelf checks, one row per shelf ("1-8" expanded).
create temp table _checks (
  visit_key text, shelf_number int, condition text, score_5 numeric, comment text
) on commit drop;
insert into _checks values
${rows(checks)};

do $$
declare missing text;
begin
  select string_agg(distinct c.visit_key || ' shelf ' || c.shelf_number, ', ') into missing
  from _checks c join _visit_ids v on v.visit_key = c.visit_key
  left join public.shelves s on s.hub_id = v.hub_id and s.number = c.shelf_number
  where s.id is null;
  if missing is not null then
    raise exception 'These shelves do not exist in the hub: %', missing;
  end if;
end $$;

insert into public.shelf_checks (visit_id, shelf_id, condition, score_5, comment)
select v.id, s.id, c.condition::public.shelf_condition, c.score_5, c.comment
from _checks c
join _new_visits v on v.visit_key = c.visit_key
join public.visits x on x.id = v.id
join public.shelves s on s.hub_id = x.hub_id and s.number = c.shelf_number
on conflict (visit_id, shelf_id) do nothing;`);
  }

  if (feedback.length) {
    parts.push(`
-- Staff feedback (only for visits added by this run: it has no unique key).
create temp table _feedback (
  visit_key text, staff_role text, "returning" boolean, tenure_note text, points text, topics text[]
) on commit drop;
insert into _feedback values
${rows(feedback)};

insert into public.staff_feedback (visit_id, staff_role, "returning", tenure_note, points, topics)
select v.id, f.staff_role::public.staff_role, f."returning", f.tenure_note, f.points, f.topics
from _feedback f join _new_visits v on v.visit_key = f.visit_key;`);
  }

  if (data.issues.length) {
    parts.push(`
-- Issues, linked to their first-seen and resolving visits.
create temp table _issues (
  issue_key text primary key, hub text, category text, severity text, title text,
  description text, exclude_from_outputs boolean, status text,
  first_visit_key text, resolved_visit_key text
) on commit drop;
insert into _issues values
${rows(data.issues.map((i) => [lit(i.key), lit(i.hub), lit(i.category), lit(i.severity), lit(i.title), lit(i.description), lit(i.excluded), lit(i.status), lit(i.firstVisitKey), lit(i.resolvedVisitKey)]))};

insert into public.issues
  (issue_key, hub_id, category, title, severity, description, status,
   first_seen_visit_id, resolved_visit_id, exclude_from_outputs)
select i.issue_key, h.id, i.category::public.issue_category, i.title,
       i.severity::public.issue_severity, i.description, i.status::public.issue_status,
       fv.id, rv.id, i.exclude_from_outputs
from _issues i
join public.hubs h on h.name = i.hub
left join _visit_ids fv on fv.visit_key = i.first_visit_key
left join _visit_ids rv on rv.visit_key = i.resolved_visit_key
on conflict (issue_key) do nothing;

-- Updates: the same issue across visits.
create temp table _updates (issue_key text, visit_key text, state text, note text) on commit drop;
insert into _updates values
${rows(updates)};

insert into public.issue_updates (issue_id, visit_id, state, note)
select x.id, v.id, u.state::public.issue_update_state, u.note
from _updates u
join public.issues x on x.issue_key = u.issue_key
join _visit_ids v on v.visit_key = u.visit_key
on conflict (issue_id, visit_id) do nothing;`);
  }

  parts.push(`
-- Rows added per table by this run.
select 'visits' as "table", (select count(*) from public.visits) - b.visits as added from _counts_before b
union all select 'shelf_checks', (select count(*) from public.shelf_checks) - b.shelf_checks from _counts_before b
union all select 'staff_feedback', (select count(*) from public.staff_feedback) - b.staff_feedback from _counts_before b
union all select 'issues', (select count(*) from public.issues) - b.issues from _counts_before b
union all select 'issue_updates', (select count(*) from public.issue_updates) - b.issue_updates from _counts_before b;
`);
  return parts.join("\n");
}

// What the file contains, for the summary printed by the CLI.
export function summary(data) {
  return {
    visits: data.visits.length,
    shelf_checks: data.visits.reduce((n, v) => n + v.checks.length, 0),
    staff_feedback: data.visits.reduce((n, v) => n + v.feedback.length, 0),
    issues: data.issues.length,
    issue_updates: data.issues.reduce((n, i) => n + i.updates.length, 0),
  };
}
