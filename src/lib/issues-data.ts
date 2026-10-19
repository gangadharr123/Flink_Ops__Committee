import "server-only";
import { SEVERITY_RANK, type IssueCategory, type Severity } from "@/lib/issues";
import { createClient } from "@/lib/supabase/server";
import type { Database, Enums } from "@/lib/database.types";
import { signPhotoUrls, type IssuePhoto } from "@/lib/visits";

// Read helpers for the Issues pages. Call inside <Suspense>.

export type IssueFilters = {
  hub?: string; // hub name
  severity?: Severity;
  status?: Enums<"issue_status">; // undefined = all
};

export type IssueListItem = {
  id: string;
  key: string;
  title: string;
  category: IssueCategory;
  severity: Severity;
  status: Enums<"issue_status">;
  hubName: string;
  excluded: boolean;
  fromDraft: boolean;
  visitsSeen: number;
  isRecurring: boolean;
  daysOpen: number | null;
  lastSeen: string | null;
};

// Open first, then most severe, then most recently seen.
export async function listIssues(filters: IssueFilters): Promise<IssueListItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("issues")
    .select(
      `id, issue_key, title, category, severity, status, exclude_from_outputs,
       hub:hubs!inner (name),
       first_seen:visits!issues_first_seen_visit_id_fkey (status)`,
    );
  if (filters.hub) query = query.eq("hub.name", filters.hub);
  if (filters.severity) query = query.eq("severity", filters.severity);
  if (filters.status) query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error) throw error;
  const stats = await getStats(data.map((i) => i.id));

  return data
    .map((i) => {
      const s = stats.get(i.id);
      return {
        id: i.id,
        key: i.issue_key,
        title: i.title,
        category: i.category,
        severity: i.severity,
        status: i.status,
        hubName: i.hub.name,
        excluded: i.exclude_from_outputs,
        fromDraft: i.first_seen?.status === "draft",
        visitsSeen: s?.visits_seen ?? 0,
        isRecurring: s?.is_recurring ?? false,
        daysOpen: s?.days_open ?? null,
        lastSeen: s?.last_seen_date ?? null,
      };
    })
    .sort(
      (a, b) =>
        Number(a.status === "resolved") - Number(b.status === "resolved") ||
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
        (b.lastSeen ?? "").localeCompare(a.lastSeen ?? ""),
    );
}

export type TimelineEntry = {
  visitId: string;
  visitLabel: string;
  visitDate: string;
  visitStatus: Enums<"visit_status">;
  state: Enums<"issue_update_state">;
  note: string | null;
  photos: IssuePhoto[];
};

// One issue with its numbers and a timeline: one entry per visit, oldest first.
export async function getIssueDetail(issueId: string) {
  const supabase = await createClient();
  const { data: issue, error } = await supabase
    .from("issues")
    .select(
      `id, issue_key, title, category, severity, status, description,
       exclude_from_outputs, hub:hubs (name),
       updates:issue_updates (visit_id, state, note,
         visit:visits (label, visit_number, visit_date, status))`,
    )
    .eq("id", issueId)
    .maybeSingle();
  if (error) throw error;
  if (!issue) return null;

  const [stats, photos] = await Promise.all([
    getStats([issue.id]),
    supabase
      .from("photos")
      .select("id, visit_id, storage_path, caption")
      .eq("issue_id", issue.id)
      .order("created_at"),
  ]);
  if (photos.error) throw photos.error;
  const urls = await signPhotoUrls(
    supabase,
    photos.data.map((p) => p.storage_path),
  );

  const timeline: TimelineEntry[] = issue.updates
    .filter((u) => u.visit)
    .map((u) => ({
      visitId: u.visit_id,
      visitLabel: u.visit!.label ?? `Visit ${u.visit!.visit_number}`,
      visitDate: u.visit!.visit_date,
      visitStatus: u.visit!.status,
      state: u.state,
      note: u.note,
      photos: photos.data
        .filter((p) => p.visit_id === u.visit_id)
        .map((p) => ({ id: p.id, url: urls.get(p.storage_path) ?? null, caption: p.caption })),
    }))
    .sort((a, b) => a.visitDate.localeCompare(b.visitDate));

  const s = stats.get(issue.id);
  return {
    id: issue.id,
    key: issue.issue_key,
    title: issue.title,
    category: issue.category,
    severity: issue.severity,
    status: issue.status,
    description: issue.description,
    excluded: issue.exclude_from_outputs,
    hubName: issue.hub.name,
    visitsSeen: s?.visits_seen ?? 0,
    isRecurring: s?.is_recurring ?? false,
    daysOpen: s?.days_open ?? null,
    firstSeen: s?.first_seen_date ?? null,
    resolvedDate: s?.resolved_date ?? null,
    timeline,
  };
}

type IssueStats = Database["public"]["Views"]["issue_stats"]["Row"];

// Numbers from the issue_stats view (visits seen, recurring, days open).
export async function getStats(issueIds: string[]): Promise<Map<string, IssueStats>> {
  if (issueIds.length === 0) return new Map();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("issue_stats")
    .select("*")
    .in("issue_id", issueIds);
  if (error) throw error;
  return new Map(data.flatMap((s) => (s.issue_id ? [[s.issue_id, s] as const] : [])));
}
