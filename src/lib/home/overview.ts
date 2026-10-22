// Home: one summary per hub. Pure, so it is tested on its own.
// Same rules as the dashboard: submitted visits only for "last visit";
// issues hidden from reports, and issues first seen in a draft, are left out.
import type { DashboardRows } from "@/lib/dashboard/aggregate";
import { SEVERITY_RANK, type Severity } from "@/lib/issues";

export type HubOverview = {
  hubId: string;
  hub: string;
  lastVisit: { id: string; label: string; date: string; daysSince: number } | null;
  // "due" = no submitted visit in the current calendar month
  visitedThisMonth: boolean;
  openImmediate: number;
  oldestOpen: { id: string; title: string; severity: Severity; daysOpen: number | null } | null;
  // a draft to continue, if there is one
  draft: { id: string; label: string } | null;
};

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

export function buildHubOverview(
  rows: Pick<DashboardRows, "hubs" | "visits" | "issues" | "stats">,
  today: string,
): HubOverview[] {
  const stats = new Map(rows.stats.map((s) => [s.issue_id, s]));
  const draftIds = new Set(rows.visits.filter((v) => v.status === "draft").map((v) => v.id));
  const label = (v: { label: string | null; visit_number: number }) =>
    v.label ?? `Visit ${v.visit_number}`;

  return rows.hubs.map((hub) => {
    const visits = rows.visits.filter((v) => v.hub_id === hub.id);
    const last = visits
      .filter((v) => v.status === "submitted")
      .sort((a, b) => b.visit_date.localeCompare(a.visit_date) || b.visit_number - a.visit_number)[0];
    const draft = visits
      .filter((v) => v.status === "draft")
      .sort((a, b) => b.visit_number - a.visit_number)[0];

    const open = rows.issues.filter(
      (i) =>
        i.hub_id === hub.id &&
        i.status === "open" &&
        !i.exclude_from_outputs &&
        !(i.first_seen_visit_id && draftIds.has(i.first_seen_visit_id)),
    );
    const oldest = open
      .map((i) => ({ ...i, daysOpen: stats.get(i.id)?.days_open ?? null }))
      .sort(
        (a, b) =>
          (b.daysOpen ?? -1) - (a.daysOpen ?? -1) ||
          SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
      )[0];

    return {
      hubId: hub.id,
      hub: hub.name,
      lastVisit: last
        ? { id: last.id, label: label(last), date: last.visit_date, daysSince: daysBetween(last.visit_date, today) }
        : null,
      visitedThisMonth: Boolean(last && last.visit_date.slice(0, 7) === today.slice(0, 7)),
      openImmediate: open.filter((i) => i.severity === "immediate").length,
      oldestOpen: oldest
        ? { id: oldest.id, title: oldest.title, severity: oldest.severity, daysOpen: oldest.daysOpen }
        : null,
      draft: draft ? { id: draft.id, label: label(draft) } : null,
    };
  });
}
