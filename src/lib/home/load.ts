import "server-only";
import { todayInGermany } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { buildHubOverview } from "./overview";

// Data for the Home hub overview, as the logged-in user (RLS applies).
export async function loadHubOverview() {
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

  return buildHubOverview(
    {
      hubs: hubs.data ?? [],
      visits: visits.data ?? [],
      issues: issues.data ?? [],
      stats: stats.data ?? [],
    },
    todayInGermany(),
  );
}
