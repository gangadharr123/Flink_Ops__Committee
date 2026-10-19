import "server-only";
import { createClient } from "@/lib/supabase/server";

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
