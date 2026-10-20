"use server";

import { z } from "zod";
import { AIRTABLE_FIELDS } from "@/lib/airtable/answers";
import { createClient } from "@/lib/supabase/server";

const fieldSchema = z.enum(AIRTABLE_FIELDS.map((f) => f.key) as [string, ...string[]]);

// Saves one edited answer. text = null means "back to the generated text"
// (the edit is removed). Row-level security: inspectors and admins only.
export async function saveAirtableAnswer(
  visitId: string,
  field: string,
  text: string | null,
): Promise<{ error?: string }> {
  if (
    !z.uuid().safeParse(visitId).success ||
    !fieldSchema.safeParse(field).success ||
    (text !== null && text.length > 20000)
  ) {
    return { error: "Invalid answer." };
  }

  const supabase = await createClient();
  const { data: row, error: readError } = await supabase
    .from("airtable_answers")
    .select("answers")
    .eq("visit_id", visitId)
    .maybeSingle();
  if (readError) return fail(readError.message);

  const answers = { ...((row?.answers ?? {}) as Record<string, string>) };
  if (text === null) delete answers[field];
  else answers[field] = text;

  const { data, error } = await supabase
    .from("airtable_answers")
    .upsert({ visit_id: visitId, answers })
    .select("visit_id");
  if (error) return fail(error.message);
  if (data.length === 0) return { error: "Your role can't edit answers." };
  return {};
}

function fail(message: string) {
  console.error("saveAirtableAnswer failed:", message);
  return {
    error: message.includes("row-level security")
      ? "Your role can't edit answers."
      : "Could not save. Try again.",
  };
}
