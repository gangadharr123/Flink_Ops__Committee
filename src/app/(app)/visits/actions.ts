"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
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
      stock_and_space: z.string().max(5000).nullable(),
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
  issueUpserts: z
    .array(
      z.object({
        issue_id: z.uuid(),
        // "new" is only set by create_issue()
        state: z.enum(["still_open", "improved", "resolved"]),
        note: z.string().max(2000).nullable(),
      }),
    )
    .max(300),
  issueDeletes: z.array(z.uuid()).max(300),
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

  if (patch.issueUpserts.length > 0) {
    const { error } = await supabase.from("issue_updates").upsert(
      patch.issueUpserts.map((u) => ({ ...u, visit_id: visitId })),
      { onConflict: "issue_id,visit_id" },
    );
    if (error) return fail("issue update upsert", error.message);
  }

  if (patch.issueDeletes.length > 0) {
    const { error } = await supabase
      .from("issue_updates")
      .delete()
      .eq("visit_id", visitId)
      .neq("state", "new")
      .in("issue_id", patch.issueDeletes);
    if (error) return fail("issue update delete", error.message);
  }

  return {};
}

const newIssueSchema = z.object({
  category: z.enum(Constants.public.Enums.issue_category, "Pick a category"),
  title: z.string().trim().min(3, "Title is too short").max(200),
  severity: z.enum(Constants.public.Enums.issue_severity, "Pick a severity"),
  description: z.string().trim().max(5000),
  // already uploaded by the browser to visit-photos/<visit id>/<uuid>.jpg
  photoPath: z.string().optional(),
});

export type CreatedIssue = { id: string; key: string; photoId?: string };

// Creates an issue first seen on this visit (with its "new" update).
export async function createIssue(
  visitId: string,
  input: z.input<typeof newIssueSchema>,
): Promise<ActionState & { issue?: CreatedIssue }> {
  const parsed = newIssueSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { photoPath } = parsed.data;
  if (photoPath && !isVisitPhotoPath(visitId, photoPath)) return { error: "Invalid photo." };

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("create_issue", {
    p_visit_id: visitId,
    p_category: parsed.data.category,
    p_title: parsed.data.title,
    p_severity: parsed.data.severity,
    p_description: parsed.data.description,
  });
  if (error) {
    console.error("create_issue failed:", error.message);
    return { error: error.code === "42501" ? NOT_EDITABLE : "Could not add the issue. Try again." };
  }

  const { data: issue } = await supabase
    .from("issues")
    .select("issue_key")
    .eq("id", id)
    .single();
  const created = { id, key: issue?.issue_key ?? "" };

  if (photoPath) {
    const { data: photo, error: photoError } = await supabase
      .from("photos")
      .insert({ visit_id: visitId, issue_id: id, storage_path: photoPath })
      .select("id")
      .single();
    if (photoError) {
      // The issue is saved; only the photo link failed.
      console.error("photo insert failed:", photoError.message);
      await removeFiles(supabase, [photoPath]);
      return { issue: created, error: "Issue saved, but the photo could not be attached." };
    }
    return { issue: { ...created, photoId: photo.id } };
  }
  return { issue: created };
}

// Deletes an issue added on this (draft) visit, with its photo files.
export async function deleteIssue(visitId: string, issueId: string): Promise<ActionState> {
  const supabase = await createClient();
  const { data: photos } = await supabase
    .from("photos")
    .select("storage_path")
    .eq("visit_id", visitId)
    .eq("issue_id", issueId);

  const { data, error } = await supabase
    .from("issues")
    .delete()
    .eq("id", issueId)
    .eq("first_seen_visit_id", visitId)
    .select("id");
  if (error) return fail("issue delete", error.message);
  if (data.length === 0) return { error: NOT_EDITABLE };

  await removeFiles(supabase, (photos ?? []).map((p) => p.storage_path));
  return {};
}

// The browser uploads to visit-photos/<visit id>/<uuid>.jpg; only accept that.
function isVisitPhotoPath(visitId: string, path: string) {
  return new RegExp(`^${visitId}/[0-9a-f-]{36}\\.jpg$`).test(path);
}

// Links an uploaded photo to an issue on this visit (new or already open).
export async function addIssuePhoto(
  visitId: string,
  issueId: string,
  photoPath: string,
): Promise<ActionState & { photoId?: string }> {
  if (!z.uuid().safeParse(issueId).success || !isVisitPhotoPath(visitId, photoPath)) {
    return { error: "Invalid photo." };
  }
  const supabase = await createClient();

  // The issue must belong to the same hub as the visit.
  const [{ data: visit }, { data: issue }] = await Promise.all([
    supabase.from("visits").select("hub_id").eq("id", visitId).maybeSingle(),
    supabase.from("issues").select("hub_id").eq("id", issueId).maybeSingle(),
  ]);
  if (!visit || !issue || visit.hub_id !== issue.hub_id) {
    await removeFiles(supabase, [photoPath]);
    return { error: "Invalid photo." };
  }

  // Row-level security: only inspectors/admins, only while the visit is a draft.
  const { data, error } = await supabase
    .from("photos")
    .insert({ visit_id: visitId, issue_id: issueId, storage_path: photoPath })
    .select("id")
    .single();
  if (error) {
    await removeFiles(supabase, [photoPath]);
    return fail("photo insert", error.message);
  }
  return { photoId: data.id };
}

// Deletes a photo (row and file) from a draft visit.
export async function deletePhoto(visitId: string, photoId: string): Promise<ActionState> {
  if (!z.uuid().safeParse(photoId).success) return { error: "Invalid photo." };
  const supabase = await createClient();
  const { data: photo } = await supabase
    .from("photos")
    .select("storage_path")
    .eq("id", photoId)
    .eq("visit_id", visitId)
    .maybeSingle();
  if (!photo) return { error: "Photo not found." };

  const { data, error } = await supabase
    .from("photos")
    .delete()
    .eq("id", photoId)
    .select("id");
  if (error) return fail("photo delete", error.message);
  if (data.length === 0) return { error: NOT_EDITABLE };
  await removeFiles(supabase, [photo.storage_path]);
  return {};
}

// Storage files aren't deleted with their database rows, so remove them.
// Failure only leaves an orphan file, so it is logged, not shown.
async function removeFiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  paths: string[],
) {
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from("visit-photos").remove(paths);
  if (error) console.error("photo file delete failed:", error.message);
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

// Deletes a visit. Admins: any visit. Inspectors: drafts only.
// Row-level security enforces the same rule; this check just gives a clear
// message. The database removes the visit's shelf checks, staff feedback,
// photo rows, issue updates and issues recorded only on this visit (see the
// delete_visit migration). Photo files in Storage are removed here.
export async function deleteVisit(visitId: string): Promise<ActionState> {
  if (!z.uuid().safeParse(visitId).success) return { error: "Invalid visit." };
  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()]);
  const isAdmin = user.role === "admin";

  const { data: visit } = await supabase
    .from("visits")
    .select("status")
    .eq("id", visitId)
    .maybeSingle();
  if (!visit) return { error: "Visit not found." };
  if (visit.status !== "draft" && !isAdmin) {
    return { error: "Only admins can delete submitted visits." };
  }

  const { data: photos } = await supabase
    .from("photos")
    .select("storage_path")
    .eq("visit_id", visitId);
  const paths = (photos ?? []).map((p) => p.storage_path);

  // Inspectors: storage only lets them remove files while the draft
  // exists, so files go first. Admins: delete the visit first, so a refused
  // delete never leaves a visit with missing photos.
  if (!isAdmin) await removeFiles(supabase, paths);

  const { data, error } = await supabase.from("visits").delete().eq("id", visitId).select("id");
  if (error) return fail("delete", error.message);
  if (data.length === 0) {
    return { error: isAdmin ? "Could not delete this visit." : "Only draft visits can be deleted." };
  }

  if (isAdmin) await removeFiles(supabase, paths);
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
