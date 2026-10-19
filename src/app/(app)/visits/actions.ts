"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { Constants } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import type { VisitPatch } from "@/lib/visit-form";

// Server Actions for the visit flow. Each one runs on the server as the
// logged-in user, so row-level security still decides what is allowed.

export type ActionState = { error?: string };

const newVisitSchema = z.object({
  hubId: z.uuid("Pick a hub"),
  visitDate: z.iso.date("Pick a date"),
});

export async function createVisit(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = newVisitSchema.safeParse({
    hubId: formData.get("hubId"),
    visitDate: formData.get("visitDate"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // create_visit() (see the visit_flow migration) picks the next visit
  // number and pre-fills shelf checks from the last submitted visit.
  const { data: visitId, error } = await supabase.rpc("create_visit", {
    p_hub_id: parsed.data.hubId,
    p_visit_date: parsed.data.visitDate,
  });
  if (error) {
    console.error("create_visit failed:", error.message);
    return {
      error: error.message.includes("row-level security")
        ? "Your role can't create visits. Ask an admin."
        : "Could not create the visit. Try again.",
    };
  }

  redirect(`/visits/${visitId}`);
}

// Autosave. The patch only holds what changed since the last save
// (see buildPatch in src/lib/visit-form.ts). Validated again here because
// anything sent from a browser can be tampered with.
const conditionSchema = z.enum(Constants.public.Enums.shelf_condition);
const patchSchema = z.object({
  visit: z
    .object({
      manager_present: z.boolean().nullable(),
      overall_impression: z.string().max(5000).nullable(),
      notes: z.string().max(5000).nullable(),
      current_step: z.enum(Constants.public.Enums.visit_step),
    })
    .partial()
    .optional(),
  shelfUpserts: z
    .array(
      z.object({
        shelf_id: z.uuid(),
        condition: conditionSchema,
        score_5: z.number().min(0).max(5).nullable(),
        comment: z.string().max(2000).nullable(),
      }),
    )
    .max(500),
  shelfDeletes: z.array(z.uuid()).max(500),
  staffUpserts: z
    .array(
      z.object({
        id: z.uuid(),
        staff_role: z.enum(Constants.public.Enums.staff_role),
        returning: z.boolean(),
        tenure_note: z.string().max(500).nullable(),
        points: z.string().max(5000).nullable(),
        topics: z.array(z.string().min(1).max(60)).max(30),
      }),
    )
    .max(100),
  staffDeletes: z.array(z.uuid()).max(100),
});

const NOT_EDITABLE = "This visit can't be edited (submitted, deleted, or your role).";

export async function saveVisit(
  visitId: string,
  input: VisitPatch,
): Promise<ActionState> {
  const parsed = patchSchema.safeParse(input);
  if (!z.uuid().safeParse(visitId).success || !parsed.success) {
    return { error: "Invalid data. Reload the page." };
  }
  const patch = parsed.data;
  const supabase = await createClient();

  // Row-level security silently skips rows you may not change, so ask for the
  // updated row back to tell "saved" from "not allowed".
  if (patch.visit && Object.keys(patch.visit).length > 0) {
    const { data, error } = await supabase
      .from("visits")
      .update(patch.visit)
      .eq("id", visitId)
      .eq("status", "draft")
      .select("id");
    if (error) return fail("visit update", error.message);
    if (data.length === 0) return { error: NOT_EDITABLE };
  }

  if (patch.shelfUpserts.length > 0) {
    const { error } = await supabase.from("shelf_checks").upsert(
      patch.shelfUpserts.map((c) => ({ ...c, visit_id: visitId })),
      { onConflict: "visit_id,shelf_id" },
    );
    if (error) return fail("shelf upsert", error.message);
  }

  if (patch.shelfDeletes.length > 0) {
    const { error } = await supabase
      .from("shelf_checks")
      .delete()
      .eq("visit_id", visitId)
      .in("shelf_id", patch.shelfDeletes);
    if (error) return fail("shelf delete", error.message);
  }

  if (patch.staffUpserts.length > 0) {
    const { error } = await supabase
      .from("staff_feedback")
      .upsert(patch.staffUpserts.map((f) => ({ ...f, visit_id: visitId })));
    if (error) return fail("staff upsert", error.message);
  }

  if (patch.staffDeletes.length > 0) {
    const { error } = await supabase
      .from("staff_feedback")
      .delete()
      .eq("visit_id", visitId)
      .in("id", patch.staffDeletes);
    if (error) return fail("staff delete", error.message);
  }

  return {};
}

export async function submitVisit(visitId: string): Promise<ActionState> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("visits")
    .update({ status: "submitted", current_step: "summary" })
    .eq("id", visitId)
    .eq("status", "draft")
    .select("id");
  if (error) return fail("submit", error.message);
  if (data.length === 0) return { error: NOT_EDITABLE };
  return {};
}

export async function deleteVisit(visitId: string): Promise<ActionState> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("visits")
    .delete()
    .eq("id", visitId)
    .eq("status", "draft")
    .select("id");
  if (error) return fail("delete", error.message);
  if (data.length === 0) return { error: "Only draft visits can be deleted." };
  redirect("/visits");
}

function fail(what: string, message: string): ActionState {
  console.error(`saveVisit ${what} failed:`, message);
  return {
    error: message.includes("row-level security")
      ? NOT_EDITABLE
      : "Could not save. Will retry.",
  };
}
