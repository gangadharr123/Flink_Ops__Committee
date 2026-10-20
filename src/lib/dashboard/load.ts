import "server-only";
import { todayInGermany } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { buildDashboard, type DashboardRows } from "./aggregate";

// Loads everything the dashboard needs in parallel, as the logged-in user
// (row-level security applies), then aggregates it.
export async function loadDashboard() {
  const supabase = await createClient();

  const [hubs, visits, issues, stats] = await Promise.all([
    supabase.from("hubs").select("id, name").order("name"),
    supabase.from("visits").select("id, hub_id, visit_number, label, visit_date, status"),
    supabase
      .from("issues")
      .select(
        "id, hub_id, title, severity, status, exclude_from_outputs, first_seen_visit_id, resolved_visit_id",
      ),
    supabase.from("issue_stats").select("issue_id, visits_seen, is_recurring, days_open"),
  ]);
  for (const r of [hubs, visits, issues, stats]) if (r.error) throw r.error;

  const submittedIds = (visits.data ?? []).filter((v) => v.status === "submitted").map((v) => v.id);
  const [shelfChecks, feedback] = submittedIds.length
    ? await Promise.all([
        supabase.from("shelf_checks").select("visit_id, condition").in("visit_id", submittedIds),
        supabase.from("staff_feedback").select("visit_id, topics").in("visit_id", submittedIds),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];
  if (shelfChecks.error) throw shelfChecks.error;
  if (feedback.error) throw feedback.error;

  const rows: DashboardRows = {
    hubs: hubs.data ?? [],
    visits: visits.data ?? [],
    issues: issues.data ?? [],
    stats: stats.data ?? [],
    shelfChecks: shelfChecks.data ?? [],
    feedback: feedback.data ?? [],
  };
  return buildDashboard(rows, todayInGermany());
}
