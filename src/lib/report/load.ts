import "server-only";
import { getStats } from "@/lib/issues-data";
import { createClient } from "@/lib/supabase/server";
import type { ReportInput } from "./model";

// Gathers everything the report (and the Airtable answers) need for one
// visit, as the logged-in user (row-level security applies).
//   allowDraft: the report needs a submitted visit; Airtable answers don't
//   withImages: download photos of issues that aren't excluded (for .docx)
export async function loadReportData(
  visitId: string,
  { allowDraft = false, withImages = true } = {},
): Promise<
  | {
      status: "ok";
      input: ReportInput;
      images: Map<string, Buffer>;
      visit: { id: string; hubId: string; visitNumber: number; status: "draft" | "submitted" };
    }
  | { status: "not-found" | "not-submitted" }
> {
  const supabase = await createClient();

  const { data: visit, error } = await supabase
    .from("visits")
    .select(
      `id, hub_id, visit_number, label, visit_date, status, manager_present,
       stock_and_space, overall_impression,
       hub:hubs (name),
       inspector:profiles!visits_inspector_id_fkey (full_name)`,
    )
    .eq("id", visitId)
    .maybeSingle();
  if (error) throw error;
  if (!visit) return { status: "not-found" };
  if (visit.status !== "submitted" && !allowDraft) return { status: "not-submitted" };

  const [shelves, checks, updates, staff, photos] = await Promise.all([
    supabase.from("shelves").select("id, number, zone").eq("hub_id", visit.hub_id),
    supabase
      .from("shelf_checks")
      .select("shelf_id, condition, score_5, comment")
      .eq("visit_id", visit.id),
    supabase
      .from("issue_updates")
      .select(
        `state, note,
         issue:issues (id, title, category, severity, description, exclude_from_outputs)`,
      )
      .eq("visit_id", visit.id),
    supabase
      .from("staff_feedback")
      .select("staff_role, returning, tenure_note, points, topics")
      .eq("visit_id", visit.id)
      .order("created_at"),
    supabase
      .from("photos")
      .select("issue_id, storage_path, caption")
      .eq("visit_id", visit.id)
      .not("issue_id", "is", null)
      .order("created_at"),
  ]);
  for (const result of [shelves, checks, updates, staff, photos]) {
    if (result.error) throw result.error;
  }

  const issueRows = (updates.data ?? []).filter((u) => u.issue);
  const issueIds = issueRows.map((u) => u.issue!.id);
  const [stats, history] = await Promise.all([
    getStats(issueIds),
    // every update on these issues, for "first recorded on Visit 1 (...)"
    issueIds.length
      ? supabase
          .from("issue_updates")
          .select("issue_id, state, visit:visits (label, visit_number, visit_date)")
          .in("issue_id", issueIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (history.error) throw history.error;
  const checkByShelf = new Map((checks.data ?? []).map((c) => [c.shelf_id, c]));

  const issues: ReportInput["issues"] = issueRows.map((u) => {
    const issue = u.issue!;
    return {
      id: issue.id,
      title: issue.title,
      category: issue.category,
      severity: issue.severity,
      description: issue.description,
      excluded: issue.exclude_from_outputs,
      visitsSeen: stats.get(issue.id)?.visits_seen ?? 1,
      state: u.state,
      note: u.note,
      photos: (photos.data ?? [])
        .filter((p) => p.issue_id === issue.id)
        .map((p) => ({ path: p.storage_path, caption: p.caption })),
      history: (history.data ?? [])
        .filter((h) => h.issue_id === issue.id && h.visit)
        .map((h) => ({
          visitLabel: h.visit!.label ?? `Visit ${h.visit!.visit_number}`,
          visitDate: h.visit!.visit_date,
          state: h.state,
        }))
        .sort((a, b) => a.visitDate.localeCompare(b.visitDate)),
    };
  });

  // Only download photos that will actually appear.
  const wanted = withImages
    ? issues.filter((i) => !i.excluded).flatMap((i) => i.photos.map((p) => p.path))
    : [];
  const images = new Map<string, Buffer>();
  await Promise.all(
    wanted.map(async (path) => {
      const { data, error: downloadError } = await supabase.storage
        .from("visit-photos")
        .download(path);
      if (downloadError || !data) {
        console.error("report photo download failed:", path, downloadError?.message);
        return; // the report still works without this photo
      }
      images.set(path, Buffer.from(await data.arrayBuffer()));
    }),
  );

  const input: ReportInput = {
    hubName: visit.hub.name,
    visitNumber: visit.visit_number,
    visitLabel: visit.label ?? `Visit ${visit.visit_number}`,
    visitDate: visit.visit_date,
    preparedBy: visit.inspector?.full_name ?? null,
    managerPresent: visit.manager_present,
    stockAndSpace: visit.stock_and_space,
    overallImpression: visit.overall_impression,
    shelves: (shelves.data ?? []).map((s) => {
      const check = checkByShelf.get(s.id);
      return {
        number: s.number,
        zone: s.zone,
        condition: check?.condition ?? null,
        score: check?.score_5 ?? null,
        comment: check?.comment ?? null,
      };
    }),
    issues,
    staff: (staff.data ?? []).map((f) => ({
      role: f.staff_role,
      returning: f.returning,
      tenureNote: f.tenure_note,
      points: f.points,
      topics: f.topics,
    })),
  };

  return {
    status: "ok",
    input,
    images,
    visit: {
      id: visit.id,
      hubId: visit.hub_id,
      visitNumber: visit.visit_number,
      status: visit.status,
    },
  };
}
