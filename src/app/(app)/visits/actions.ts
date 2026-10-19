"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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
