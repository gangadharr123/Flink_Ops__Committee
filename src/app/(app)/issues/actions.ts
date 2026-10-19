"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Hide an issue from reports and Airtable text (or show it again).
// Allowed for inspectors and admins at any time: the issue isn't part of
// one visit, so it stays editable after visits are submitted.
export async function setIssueExcluded(
  issueId: string,
  excluded: boolean,
): Promise<{ error?: string }> {
  if (!z.uuid().safeParse(issueId).success) return { error: "Invalid issue." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("issues")
    .update({ exclude_from_outputs: excluded })
    .eq("id", issueId)
    .select("id");
  if (error) {
    console.error("setIssueExcluded failed:", error.message);
    return { error: "Could not save. Try again." };
  }
  // Row-level security skipped it: the user's role can't edit issues.
  if (data.length === 0) return { error: "Your role can't change issues." };
  return {};
}
