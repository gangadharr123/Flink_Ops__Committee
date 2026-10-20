// Airtable form answers, written from the visit data as full sentences.
// Pure (no Supabase), so it is easy to test. Same rules as the report:
// skip excluded issues, "recurring, seen on N visits", no em dashes.
import { formatLongDate } from "@/lib/format";
import {
  RECURRING_MIN_VISITS,
  recurringLabel,
  SEVERITY_RANK,
} from "@/lib/issues";
import { formatRanges, noDashes, sentence, type ReportInput } from "@/lib/report/model";
import { STAFF_ROLES, type Condition, type StaffRole } from "@/lib/visit-form";

export const AIRTABLE_FIELDS = [
  { key: "cleanliness", label: "Cleanliness summary" },
  { key: "positive", label: "Positive observations" },
  { key: "critical", label: "Critical observations" },
  { key: "employees", label: "Employees spoken to" },
  { key: "topics", label: "Recurring employee topics" },
] as const;

export type AirtableField = (typeof AIRTABLE_FIELDS)[number]["key"];
export type AirtableAnswers = Record<AirtableField, string>;

// Topic tags from this visit and the hub's previous visits.
export type TopicHistory = {
  visitsConsidered: number; // this visit + up to 2 previous submitted ones
  // one entry per staff feedback row: which visit, which tags
  rows: { visitId: string; topics: string[] }[];
};

type Issue = ReportInput["issues"][number];
type Shelf = ReportInput["shelves"][number];

// ---- helpers -------------------------------------------------------------

// ["a"] -> "a"; ["a","b"] -> "a and b"; ["a","b","c"] -> "a, b and c"
export function joinList(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const shelfWord = (n: number) => plural(n, "shelf", "shelves");
// "fridge_mould" -> "fridge mould"
const topicText = (tag: string) => tag.replaceAll("_", " ");

function shelfList(shelves: Shelf[]) {
  const numbers = shelves.map((s) => s.number);
  return `${shelfWord(numbers.length)} ${formatRanges(numbers)}`;
}

function firstRecorded(issue: Issue, input: ReportInput) {
  const first = issue.history?.[0];
  if (!first || (first.visitDate === input.visitDate && first.visitLabel === input.visitLabel)) {
    return "first recorded on this visit";
  }
  return `first recorded on ${first.visitLabel} (${formatLongDate(first.visitDate)})`;
}

const visible = (input: ReportInput) => input.issues.filter((i) => !i.excluded);

// ---- the five answers ----------------------------------------------------

function cleanliness(input: ReportInput): string {
  const checked = input.shelves.filter((s) => s.condition !== null);
  if (checked.length === 0) return "No shelf inspection was recorded for this visit.";
  const parts: string[] = [];

  const unchecked = input.shelves.filter((s) => s.condition === null);
  parts.push(
    unchecked.length === 0
      ? `All ${input.shelves.length} shelves were inspected during this visit.`
      : `${checked.length} of ${input.shelves.length} shelves were inspected during this visit (${shelfList(unchecked)} ${plural(unchecked.length, "was", "were")} not checked).`,
  );

  const by = (c: Condition) => checked.filter((s) => s.condition === c);
  const findings: string[] = [];
  if (by("clean").length) findings.push(`${by("clean").length} ${shelfWord(by("clean").length)} were clean`);
  if (by("minor_dust").length)
    findings.push(`${by("minor_dust").length} showed minor dust (${shelfList(by("minor_dust"))})`);
  if (by("dusty").length) findings.push(`${by("dusty").length} were dusty (${shelfList(by("dusty"))})`);
  if (by("damaged").length)
    findings.push(`${by("damaged").length} were damaged (${shelfList(by("damaged"))})`);
  // Explicit full stop: the list may end in ")", which sentence() treats as an ending.
  if (findings.length) parts.push(`${joinList(findings).replace(/^./, (c) => c.toUpperCase())}.`);

  if (by("mould").length) {
    parts.push(
      `Mould was found on ${shelfList(by("mould"))}, which is a food safety risk and needs immediate cleaning.`,
    );
  }

  const scored = checked.filter((s) => s.score !== null);
  if (scored.length) {
    const avg = scored.reduce((sum, s) => sum + s.score!, 0) / scored.length;
    parts.push(
      `The average cleanliness score was ${avg.toFixed(1)} out of 5 across ${scored.length} scored ${shelfWord(scored.length)}.`,
    );
  }

  // Comments, grouped: "Dust on upper racks (shelves 1-8)."
  const byComment = new Map<string, Shelf[]>();
  for (const s of checked) {
    const c = s.comment?.trim();
    if (c) byComment.set(c, [...(byComment.get(c) ?? []), s]);
  }
  if (byComment.size) {
    const notes = [...byComment].map(([c, list]) => `${c.replace(/[.!]$/, "")} (${shelfList(list)})`);
    parts.push(`Notes from the inspection: ${joinList(notes)}.`);
  }

  for (const issue of visible(input).filter((i) => i.category === "shelf_hygiene")) {
    if (issue.state === "resolved") {
      parts.push(`${issue.title} was resolved on this visit.`);
    } else if (issue.visitsSeen >= RECURRING_MIN_VISITS) {
      parts.push(`${issue.title} is recurring, seen on ${issue.visitsSeen} visits, and remains unresolved.`);
    }
  }
  return parts.join(" ");
}

function positive(input: ReportInput): string {
  const parts: string[] = [];
  const checked = input.shelves.filter((s) => s.condition !== null);
  const clean = checked.filter((s) => s.condition === "clean");
  const minor = checked.filter((s) => s.condition === "minor_dust");

  if (clean.length) {
    let text = `${clean.length} of the ${checked.length} inspected shelves were clean`;
    if (minor.length) text += ` and a further ${minor.length} showed only minor dust`;
    parts.push(`${text}.`);
  }
  // Zones where every inspected shelf was clean.
  const zones = [
    ["fridge", "fridge"],
    ["freezer", "freezer"],
    ["dry", "dry goods"],
    ["ambient", "ambient"],
  ] as const;
  for (const [zone, name] of zones) {
    const inZone = checked.filter((s) => s.zone === zone);
    if (inZone.length > 1 && inZone.every((s) => s.condition === "clean")) {
      parts.push(
        inZone.length === 2
          ? `Both ${name} shelves were clean.`
          : `All ${inZone.length} ${name} shelves were clean.`,
      );
    }
  }

  const improved = visible(input).filter((i) => i.state === "improved");
  const resolved = visible(input).filter((i) => i.state === "resolved");
  if (improved.length) {
    parts.push(
      `${plural(improved.length, "One issue has", `${improved.length} issues have`)} improved since the last visit: ${joinList(improved.map((i) => i.title))}.`,
    );
  }
  if (resolved.length) {
    parts.push(
      `${plural(resolved.length, "One issue was", `${resolved.length} issues were`)} resolved: ${joinList(resolved.map((i) => i.title))}.`,
    );
  }

  // Positive staff topics: tags like "colleagues_positive".
  const positiveTopics = new Map<string, number>();
  for (const person of input.staff) {
    for (const tag of person.topics ?? []) {
      if (/(^|_)positive($|_)/.test(tag)) positiveTopics.set(tag, (positiveTopics.get(tag) ?? 0) + 1);
    }
  }
  for (const [tag, count] of positiveTopics) {
    const subject = topicText(tag.replace(/(^|_)positive($|_)/, " ")).trim() || "the hub";
    parts.push(
      `${count} ${plural(count, "employee", "employees")} spoke positively about ${subject}.`,
    );
  }

  if (input.managerPresent) parts.push("The hub manager was present during the visit.");

  return parts.length ? parts.join(" ") : "No specific positive observations were recorded for this visit.";
}

function critical(input: ReportInput): string {
  const open = visible(input)
    .filter((i) => i.state !== "resolved")
    .sort(
      (a, b) =>
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
        b.visitsSeen - a.visitsSeen ||
        a.title.localeCompare(b.title),
    );
  if (open.length === 0) return "No critical issues were observed during this visit.";

  const lines = open.map((issue) => {
    const parts = [`${issue.title} (${issue.severity} priority): ${firstRecorded(issue, input)}`];
    if (issue.visitsSeen >= RECURRING_MIN_VISITS) parts[0] += `, ${recurringLabel(issue.visitsSeen)}`;
    else if (issue.visitsSeen > 1) parts[0] += `, seen on ${issue.visitsSeen} visits`;
    parts[0] = sentence(parts[0]);

    const status =
      issue.state === "new"
        ? "It was raised for the first time on this visit."
        : issue.state === "improved"
          ? "It has improved on this visit but is not yet resolved."
          : "It is still open on this visit.";
    parts.push(status);
    if (issue.state === "new" && issue.description?.trim()) parts.push(sentence(issue.description));
    if (issue.note?.trim()) parts.push(sentence(issue.note));
    return parts.join(" ");
  });
  return lines.join("\n");
}

function roleCount(role: StaffRole, n: number) {
  const label = STAFF_ROLES.find((r) => r.value === role)!.label.toLowerCase();
  return `${n} ${n === 1 ? label : `${label}s`}`;
}

function employees(input: ReportInput): string {
  const n = input.staff.length;
  if (n === 0) return "No employees were spoken to during this visit.";
  const parts: string[] = [];

  const roles = STAFF_ROLES.map((r) => ({
    role: r.value,
    count: input.staff.filter((s) => s.role === r.value).length,
  })).filter((r) => r.count > 0);
  parts.push(
    `I spoke to ${n} ${plural(n, "employee", "employees")} during this visit: ${joinList(roles.map((r) => roleCount(r.role, r.count)))}.`,
  );

  // Rows written per group, e.g. "4 ops associates, combined" (seed README).
  const groups = input.staff.filter((s) => /combined|group/i.test(s.tenureNote ?? ""));
  if (groups.length) {
    parts.push(
      `Some feedback was recorded per group rather than per person: ${joinList(groups.map((g) => g.tenureNote!.trim()))}.`,
    );
  }
  const returning = input.staff.filter((s) => s.returning).length;
  if (returning) {
    parts.push(`${returning} of them had also been spoken to on an earlier visit.`);
  }
  const tenures = input.staff
    .filter((s) => s.tenureNote?.trim() && !/combined|group/i.test(s.tenureNote))
    .map((s) => s.tenureNote!.trim().replace(/^./, (c) => c.toLowerCase()));
  if (tenures.length) parts.push(`Tenure noted: ${joinList(tenures)}.`);
  parts.push("Feedback was recorded by role and tenure only; no names were taken.");
  return parts.join(" ");
}

function topics(input: ReportInput, history: TopicHistory): string {
  if (history.visitsConsidered < 2) {
    return `This is the first visit to ${input.hubName} with staff feedback in HubCheck, so recurring topics cannot be identified yet.`;
  }
  const counts = new Map<string, { times: number; visits: Set<string> }>();
  for (const row of history.rows) {
    for (const tag of new Set(row.topics)) {
      const c = counts.get(tag) ?? { times: 0, visits: new Set<string>() };
      c.times++;
      c.visits.add(row.visitId);
      counts.set(tag, c);
    }
  }
  // Recurring = raised on at least 2 of the visits considered.
  const recurring = [...counts]
    .filter(([, c]) => c.visits.size >= 2)
    .sort((a, b) => b[1].visits.size - a[1].visits.size || b[1].times - a[1].times || a[0].localeCompare(b[0]));

  const span = `the last ${history.visitsConsidered} visits to ${input.hubName}`;
  if (recurring.length === 0) return `No topic was raised by employees on more than one of ${span}.`;

  const items = recurring.map(
    ([tag, c]) =>
      `${topicText(tag)} (raised ${c.times} ${plural(c.times, "time", "times")} across ${c.visits.size} visits)`,
  );
  return `Across ${span}, employees raised these topics on more than one visit: ${joinList(items)}.`;
}

export function buildAirtableAnswers(input: ReportInput, history: TopicHistory): AirtableAnswers {
  const raw: AirtableAnswers = {
    cleanliness: cleanliness(input),
    positive: positive(input),
    critical: critical(input),
    employees: employees(input),
    topics: topics(input, history),
  };
  // No em dashes anywhere, including in text typed into the app.
  return Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, v.split("\n").map(noDashes).join("\n")]),
  ) as AirtableAnswers;
}
