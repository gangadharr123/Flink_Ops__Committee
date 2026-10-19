import "server-only";
import { SEVERITY_RANK, type IssueCategory, type Severity } from "@/lib/issues";
import { createClient } from "@/lib/supabase/server";
import type { Database, Enums } from "@/lib/database.types";

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
