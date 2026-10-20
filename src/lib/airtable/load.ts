import "server-only";
import { loadReportData } from "@/lib/report/load";
import { createClient } from "@/lib/supabase/server";
import { AIRTABLE_FIELDS, buildAirtableAnswers, type AirtableAnswers, type AirtableField } from "./answers";

// Generated answers plus any saved edits, for one visit (draft or submitted).
export async function loadAirtableAnswers(visitId: string) {
  const data = await loadReportData(visitId, { allowDraft: true, withImages: false });
  if (data.status !== "ok") return null;
  const supabase = await createClient();

  // Topics: this visit and the hub's 2 previous submitted visits.
  const [{ data: previous, error: prevError }, { data: saved, error: savedError }] =
    await Promise.all([
      supabase
        .from("visits")
        .select("id")
        .eq("hub_id", data.visit.hubId)
        .eq("status", "submitted")
        .lt("visit_number", data.visit.visitNumber)
        .order("visit_number", { ascending: false })
        .limit(2),
      supabase.from("airtable_answers").select("answers").eq("visit_id", visitId).maybeSingle(),
    ]);
  if (prevError) throw prevError;
  if (savedError) throw savedError;

  const visitIds = [visitId, ...(previous ?? []).map((v) => v.id)];
  const { data: feedback, error } = await supabase
    .from("staff_feedback")
    .select("visit_id, topics")
    .in("visit_id", visitIds);
  if (error) throw error;

  const generated = buildAirtableAnswers(data.input, {
    visitsConsidered: visitIds.length,
    rows: (feedback ?? []).map((f) => ({ visitId: f.visit_id, topics: f.topics })),
  });

  // Keep only known fields with text: anything else in the JSON is ignored.
  const raw = (saved?.answers ?? {}) as Record<string, unknown>;
  const edited: Partial<AirtableAnswers> = {};
  for (const { key } of AIRTABLE_FIELDS) {
    if (typeof raw[key] === "string") edited[key as AirtableField] = raw[key] as string;
  }

  return {
    visit: {
      id: visitId,
      label: data.input.visitLabel,
      hubName: data.input.hubName,
      visitDate: data.input.visitDate,
      status: data.visit.status,
    },
    generated,
    edited,
  };
}
