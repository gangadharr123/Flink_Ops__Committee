// Turns raw rows into the numbers each dashboard chart needs.
// Pure (no Supabase), so it is tested on its own. Rules:
//   * only submitted visits count (test drafts don't skew the charts)
//   * issues first seen in a draft, and issues hidden from reports, are left out
import { SEVERITY_RANK, type Severity } from "@/lib/issues";
import type { Condition } from "@/lib/visit-form";

export type DashboardRows = {
  hubs: { id: string; name: string }[];
  visits: { id: string; hub_id: string; visit_number: number; label: string | null; visit_date: string; status: "draft" | "submitted" }[];
  issues: {
    id: string;
    hub_id: string;
    title: string;
    severity: Severity;
    status: "open" | "resolved";
    exclude_from_outputs: boolean;
    first_seen_visit_id: string | null;
    resolved_visit_id: string | null;
  }[];
  stats: { issue_id: string | null; visits_seen: number | null; is_recurring: boolean | null; days_open: number | null }[];
  shelfChecks: { visit_id: string; condition: Condition }[];
  feedback: { visit_id: string; topics: string[] }[];
};

export type SeverityCounts = Record<Severity, number>;

export type Dashboard = {
  kpis: { open: number; immediateOpen: number; recurringOpen: number; visitsThisMonth: number };
  openBySeverity: ({ hub: string } & SeverityCounts)[];
  oldestOpen: {
    id: string;
    title: string;
    hub: string;
    severity: Severity;
    daysOpen: number | null;
    visitsSeen: number;
    isRecurring: boolean;
  }[];
  shelfByVisit: {
    hub: string;
    visits: { label: string; date: string; clean: number; dusty: number; mould: number }[];
  }[];
  topTopics: { topic: string; visits: number; times: number }[];
  resolvedPerMonth: { month: string; label: string; counts: Record<string, number> }[];
  hubNames: string[];
};

const MONTHS = 12;
const TOP = 10;

// "2026-10-20" -> ["2026-09", ... 12 months ending "2026-10"]
export function lastMonths(today: string, count = MONTHS) {
  const [year, month] = today.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(year, month - 1 - (count - 1 - i), 1));
    return {
      key: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }),
    };
  });
}

export function buildDashboard(rows: DashboardRows, today: string): Dashboard {
  const hubName = new Map(rows.hubs.map((h) => [h.id, h.name]));
  const submitted = rows.visits.filter((v) => v.status === "submitted");
  const submittedById = new Map(submitted.map((v) => [v.id, v]));
  const draftIds = new Set(rows.visits.filter((v) => v.status === "draft").map((v) => v.id));
  const stats = new Map(rows.stats.map((s) => [s.issue_id, s]));

  const issues = rows.issues.filter(
    (i) =>
      !i.exclude_from_outputs &&
      !(i.first_seen_visit_id && draftIds.has(i.first_seen_visit_id)),
  );
  const open = issues.filter((i) => i.status === "open");

  // Open issues per hub by severity
  const openBySeverity = rows.hubs.map((h) => {
    const counts: SeverityCounts = { immediate: 0, high: 0, medium: 0, low: 0 };
    for (const i of open) if (i.hub_id === h.id) counts[i.severity]++;
    return { hub: h.name, ...counts };
  });

  // Oldest open issues
  const oldestOpen = open
    .map((i) => {
      const s = stats.get(i.id);
      return {
        id: i.id,
        title: i.title,
        hub: hubName.get(i.hub_id) ?? "",
        severity: i.severity,
        daysOpen: s?.days_open ?? null,
        visitsSeen: s?.visits_seen ?? 0,
        isRecurring: s?.is_recurring ?? false,
      };
    })
    .sort(
      (a, b) =>
        (b.daysOpen ?? -1) - (a.daysOpen ?? -1) ||
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
    )
    .slice(0, TOP);

  // Shelf condition per submitted visit, per hub. Minor dust counts as dusty.
  const shelfByVisit = rows.hubs.map((h) => ({
    hub: h.name,
    visits: submitted
      .filter((v) => v.hub_id === h.id)
      .sort((a, b) => a.visit_number - b.visit_number)
      .map((v) => {
        const checks = rows.shelfChecks.filter((c) => c.visit_id === v.id);
        return {
          label: v.label ?? `Visit ${v.visit_number}`,
          date: v.visit_date,
          clean: checks.filter((c) => c.condition === "clean").length,
          dusty: checks.filter((c) => c.condition === "dusty" || c.condition === "minor_dust").length,
          mould: checks.filter((c) => c.condition === "mould").length,
        };
      }),
  }));

  // Top staff topics across submitted visits: ranked by visits raised on.
  const topicCounts = new Map<string, { visits: Set<string>; times: number }>();
  for (const f of rows.feedback) {
    if (!submittedById.has(f.visit_id)) continue;
    for (const tag of new Set(f.topics)) {
      const c = topicCounts.get(tag) ?? { visits: new Set<string>(), times: 0 };
      c.visits.add(f.visit_id);
      c.times++;
      topicCounts.set(tag, c);
    }
  }
  const topTopics = [...topicCounts]
    .map(([tag, c]) => ({ topic: tag.replaceAll("_", " "), visits: c.visits.size, times: c.times }))
    .filter((t) => t.visits >= 2)
    .sort((a, b) => b.visits - a.visits || b.times - a.times || a.topic.localeCompare(b.topic))
    .slice(0, TOP);

  // Issues resolved per month (by the resolving visit's date), per hub.
  const months = lastMonths(today);
  const resolvedPerMonth = months.map((m) => ({
    month: m.key,
    label: m.label,
    counts: Object.fromEntries(rows.hubs.map((h) => [h.name, 0])) as Record<string, number>,
  }));
  for (const i of issues) {
    if (i.status !== "resolved" || !i.resolved_visit_id) continue;
    const visit = submittedById.get(i.resolved_visit_id);
    const bucket = visit && resolvedPerMonth.find((m) => m.month === visit.visit_date.slice(0, 7));
    const hub = hubName.get(i.hub_id);
    if (bucket && hub) bucket.counts[hub]++;
  }

  const thisMonth = today.slice(0, 7);
  return {
    kpis: {
      open: open.length,
      immediateOpen: open.filter((i) => i.severity === "immediate").length,
      recurringOpen: open.filter((i) => stats.get(i.id)?.is_recurring).length,
      visitsThisMonth: submitted.filter((v) => v.visit_date.startsWith(thisMonth)).length,
    },
    openBySeverity,
    oldestOpen,
    shelfByVisit,
    topTopics,
    resolvedPerMonth,
    hubNames: rows.hubs.map((h) => h.name),
  };
}
