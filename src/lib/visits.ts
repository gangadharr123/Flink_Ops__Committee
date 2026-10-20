import "server-only";
import type { Enums } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import {
  RECURRING_MIN_VISITS,
  SEVERITY_RANK,
  visitsSeen,
  type IssueCategory,
  type IssueUpdateState,
  type Severity,
} from "@/lib/issues";
import {
  EMPTY_ISSUE_UPDATE,
  EMPTY_SHELF,
  issueFormKey,
  shelfKey,
  type Condition,
  type IssueUpdateChoice,
  type VisitFormValues,
  type Zone,
} from "@/lib/visit-form";

// Read helpers for visits. Row-level security decides what each user sees;
// these only shape the data for the pages. Call them inside <Suspense>.

export async function getHubs() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hubs")
    .select("id, name")
    .order("name");
  if (error) throw error;
  return data;
}

// Drafts first (the enum orders draft before submitted), then newest first.
export async function listVisits(hubName?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("visits")
    .select(
      `id, visit_number, label, visit_date, date_is_placeholder, status,
       hub:hubs!inner (name),
       inspector:profiles!visits_inspector_id_fkey (full_name)`,
    )
    .order("status")
    .order("visit_date", { ascending: false })
    .order("visit_number", { ascending: false });

  if (hubName) query = query.eq("hub.name", hubName);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export type VisitListItem = Awaited<ReturnType<typeof listVisits>>[number];

export type EditorShelf = {
  id: string;
  number: number;
  zone: Zone;
  zoneConfidence: Enums<"zone_confidence">;
  // this shelf's check on the visit that pre-filled this one
  previous: { condition: Condition; score: number | null; comment: string | null } | null;
};

// Everything the visit editor needs, in the shape of the form.
// Returns null if the visit doesn't exist (or isn't visible to this user).
export async function getVisitForEditor(visitId: string) {
  const supabase = await createClient();

  const { data: visit, error } = await supabase
    .from("visits")
    .select(
      `id, hub_id, visit_number, label, visit_date, status, current_step,
       submitted_at, previous_visit_id, manager_present, stock_and_space, overall_impression,
       notes, hub:hubs (name)`,
    )
    .eq("id", visitId)
    .maybeSingle();
  if (error) throw error;
  if (!visit) return null;

  const [shelves, checks, previousChecks, staff, topics, issues] = await Promise.all([
    supabase
      .from("shelves")
      .select("id, number, zone, zone_confidence")
      .eq("hub_id", visit.hub_id)
      .order("number"),
    supabase
      .from("shelf_checks")
      .select("shelf_id, condition, score_5, comment")
      .eq("visit_id", visit.id),
    visit.previous_visit_id
      ? supabase
          .from("shelf_checks")
          .select("shelf_id, condition, score_5, comment")
          .eq("visit_id", visit.previous_visit_id)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("staff_feedback")
      .select("id, staff_role, returning, tenure_note, points, topics")
      .eq("visit_id", visit.id)
      .order("created_at"),
    supabase.from("staff_topics").select("topic"),
    supabase
      .from("issues")
      .select(
        `id, issue_key, title, category, severity, status, description,
         exclude_from_outputs, first_seen_visit_id,
         first_seen:visits!issues_first_seen_visit_id_fkey (status),
         updates:issue_updates (visit_id, state, note,
           visit:visits (label, visit_date))`,
      )
      .eq("hub_id", visit.hub_id),
  ]);
  for (const result of [shelves, checks, previousChecks, staff, topics, issues]) {
    if (result.error) throw result.error;
  }

  // Issues for the Issues step.
  // "Open": already open before this visit, not from some other draft
  // (test visits), plus anything this visit already updated.
  // A submitted visit only shows what it actually updated.
  const isDraft = visit.status === "draft";
  const openIssues: EditorIssue[] = [];
  const newIssues: NewIssue[] = [];
  for (const issue of issues.data ?? []) {
    const updates = issue.updates ?? [];
    const own = updates.find((u) => u.visit_id === visit.id);
    const seen = visitsSeen(updates);
    const base = {
      id: issue.id,
      key: issue.issue_key,
      title: issue.title,
      category: issue.category,
      severity: issue.severity,
      description: issue.description,
      excluded: issue.exclude_from_outputs,
      visitsSeen: seen,
      isRecurring: seen >= RECURRING_MIN_VISITS,
    };

    if (issue.first_seen_visit_id === visit.id) {
      newIssues.push({ ...base, photos: [] });
      continue;
    }
    const fromOtherDraft = issue.first_seen?.status === "draft";
    const listed = own
      ? own.state !== "new"
      : isDraft && issue.status === "open" && !fromOtherDraft;
    if (!listed) continue;

    const last = updates
      .filter((u) => u.visit_id !== visit.id && u.visit)
      .sort((a, b) => b.visit!.visit_date.localeCompare(a.visit!.visit_date))[0];
    openIssues.push({
      ...base,
      last: last
        ? {
            label: last.visit!.label,
            date: last.visit!.visit_date,
            state: last.state,
            note: last.note,
          }
        : null,
      own: own && own.state !== "new" ? { state: own.state, note: own.note ?? "" } : null,
      photos: [],
    });
  }
  openIssues.sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.title.localeCompare(b.title),
  );

  const checkByShelf = new Map((checks.data ?? []).map((c) => [c.shelf_id, c]));
  const prevByShelf = new Map((previousChecks.data ?? []).map((c) => [c.shelf_id, c]));

  const editorShelves: EditorShelf[] = (shelves.data ?? []).map((s) => {
    const prev = prevByShelf.get(s.id);
    return {
      id: s.id,
      number: s.number,
      zone: s.zone,
      zoneConfidence: s.zone_confidence,
      previous: prev
        ? { condition: prev.condition, score: prev.score_5, comment: prev.comment }
        : null,
    };
  });

  const values: VisitFormValues = {
    manager_present:
      visit.manager_present === null ? "unknown" : visit.manager_present ? "yes" : "no",
    stock_and_space: visit.stock_and_space ?? "",
    overall_impression: visit.overall_impression ?? "",
    notes: visit.notes ?? "",
    shelves: Object.fromEntries(
      editorShelves.map((s) => {
        const check = checkByShelf.get(s.id);
        return [
          shelfKey(s.number),
          check
            ? {
                condition: check.condition,
                score: check.score_5 === null ? "" : String(check.score_5),
                comment: check.comment ?? "",
              }
            : { ...EMPTY_SHELF },
        ];
      }),
    ),
    staff: (staff.data ?? []).map((f) => ({
      id: f.id,
      staff_role: f.staff_role,
      returning: f.returning,
      tenure_note: f.tenure_note ?? "",
      points: f.points ?? "",
      topics: f.topics,
    })),
    issues: Object.fromEntries(
      openIssues.map((i) => [
        issueFormKey(i.id),
        i.own
          ? { state: i.own.state as IssueUpdateChoice, note: i.own.note }
          : { ...EMPTY_ISSUE_UPDATE },
      ]),
    ),
  };

  return {
    visit: {
      id: visit.id,
      hubName: visit.hub.name,
      label: visit.label ?? `Visit ${visit.visit_number}`,
      number: visit.visit_number,
      visitDate: visit.visit_date,
      status: visit.status,
      currentStep: visit.current_step,
      submittedAt: visit.submitted_at,
    },
    shelves: editorShelves,
    values,
    openIssues: await withPhotos(supabase, visit.id, openIssues),
    newIssues: await withPhotos(supabase, visit.id, newIssues),
    topicSuggestions: (topics.data ?? [])
      .map((t) => t.topic)
      .filter((t): t is string => t !== null),
  };
}

export type VisitEditorData = NonNullable<Awaited<ReturnType<typeof getVisitForEditor>>>;

type IssueBase = {
  id: string;
  key: string;
  title: string;
  category: IssueCategory;
  severity: Severity;
  description: string | null;
  excluded: boolean;
  visitsSeen: number;
  isRecurring: boolean;
};

// An issue that was open before this visit.
export type EditorIssue = IssueBase & {
  last: { label: string | null; date: string; state: IssueUpdateState; note: string | null } | null;
  own: { state: IssueUpdateState; note: string } | null;
  // photos taken on this visit
  photos: IssuePhoto[];
};

export type IssuePhoto = { id: string; url: string | null; caption: string | null };

// An issue first seen on this visit.
export type NewIssue = IssueBase & { photos: IssuePhoto[] };

// Photos are in a private bucket, so the browser gets short-lived signed
// links (valid 1 hour) instead of public URLs.
export async function signPhotoUrls(
  supabase: Awaited<ReturnType<typeof createClient>>,
  paths: string[],
) {
  if (paths.length === 0) return new Map<string, string>();
  const { data, error } = await supabase.storage
    .from("visit-photos")
    .createSignedUrls(paths, 60 * 60);
  if (error) throw error;
  return new Map(
    data.flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl] as const] : [])),
  );
}

// Adds this visit's photos (with signed links) to each issue.
async function withPhotos<T extends { id: string; photos: IssuePhoto[] }>(
  supabase: Awaited<ReturnType<typeof createClient>>,
  visitId: string,
  issues: T[],
): Promise<T[]> {
  if (issues.length === 0) return issues;
  const { data, error } = await supabase
    .from("photos")
    .select("id, issue_id, storage_path, caption")
    .eq("visit_id", visitId)
    .in(
      "issue_id",
      issues.map((i) => i.id),
    )
    .order("created_at");
  if (error) throw error;
  const urls = await signPhotoUrls(
    supabase,
    data.map((p) => p.storage_path),
  );
  return issues.map((issue) => ({
    ...issue,
    photos: data
      .filter((p) => p.issue_id === issue.id)
      .map((p) => ({ id: p.id, url: urls.get(p.storage_path) ?? null, caption: p.caption })),
  }));
}
