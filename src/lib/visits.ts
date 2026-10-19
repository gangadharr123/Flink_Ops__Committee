import "server-only";
import type { Enums } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import {
  EMPTY_SHELF,
  shelfKey,
  type Condition,
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
       submitted_at, previous_visit_id, manager_present, overall_impression,
       notes, hub:hubs (name)`,
    )
    .eq("id", visitId)
    .maybeSingle();
  if (error) throw error;
  if (!visit) return null;

  const [shelves, checks, previousChecks, staff, topics] = await Promise.all([
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
  ]);
  for (const result of [shelves, checks, previousChecks, staff, topics]) {
    if (result.error) throw result.error;
  }

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
  };

  return {
    visit: {
      id: visit.id,
      hubName: visit.hub.name,
      label: visit.label ?? `Visit ${visit.visit_number}`,
      visitDate: visit.visit_date,
      status: visit.status,
      currentStep: visit.current_step,
      submittedAt: visit.submitted_at,
    },
    shelves: editorShelves,
    values,
    topicSuggestions: (topics.data ?? [])
      .map((t) => t.topic)
      .filter((t): t is string => t !== null),
  };
}

export type VisitEditorData = NonNullable<Awaited<ReturnType<typeof getVisitForEditor>>>;
