// Shapes and pure helpers for the visit editor. No React and no Supabase
// here, so it runs in the browser, on the server and in tests.
import type { Enums } from "@/lib/database.types";

export type Condition = Enums<"shelf_condition">;
export type StaffRole = Enums<"staff_role">;
export type VisitStep = Enums<"visit_step">;
export type Zone = Enums<"shelf_zone">;

export const STEPS: { id: VisitStep; label: string }[] = [
  { id: "shelves", label: "Shelves" },
  { id: "issues", label: "Issues" },
  { id: "staff", label: "Staff" },
  { id: "summary", label: "Summary" },
];

export const CONDITIONS: { value: Condition; label: string }[] = [
  { value: "clean", label: "Clean" },
  { value: "minor_dust", label: "Minor dust" },
  { value: "dusty", label: "Dusty" },
  { value: "mould", label: "Mould" },
  { value: "damaged", label: "Damaged" },
];

export const STAFF_ROLES: { value: StaffRole; label: string }[] = [
  { value: "picker", label: "Picker" },
  { value: "rider", label: "Rider" },
  { value: "shift_lead", label: "Shift lead" },
  { value: "manager", label: "Manager" },
  { value: "other", label: "Other" },
];

// Display order of shelf groups on the shelves step.
export const ZONE_ORDER: { zone: Zone; label: string }[] = [
  { zone: "fridge", label: "Fridges" },
  { zone: "freezer", label: "Freezers" },
  { zone: "dry", label: "Dry goods" },
  { zone: "ambient", label: "Ambient" },
  { zone: "other", label: "Other" },
];

export type ManagerPresent = "yes" | "no" | "unknown";

// Form values. Text inputs hold strings ("" = empty); they become null in
// the database. Shelves are keyed by "n<number>" (see shelfKey).
export type ShelfValue = {
  condition: Condition | null;
  score: string;
  comment: string;
};

export type StaffValue = {
  id: string;
  staff_role: StaffRole | null;
  returning: boolean;
  tenure_note: string;
  points: string;
  topics: string[];
};

export type VisitFormValues = {
  manager_present: ManagerPresent;
  overall_impression: string;
  notes: string;
  shelves: Record<string, ShelfValue>;
  staff: StaffValue[];
};

export function shelfKey(number: number) {
  return `n${number}`;
}

export const EMPTY_SHELF: ShelfValue = { condition: null, score: "", comment: "" };

// "3,5" or "3.75" -> number; "" -> null; anything else -> "invalid".
// Scores are 0 to 5 with at most two decimals (the database column).
export function parseScore(raw: string): number | null | "invalid" {
  const text = raw.trim().replace(",", ".");
  if (text === "") return null;
  if (!/^\d(\.\d{1,2})?$/.test(text)) return "invalid";
  const value = Number(text);
  return value <= 5 ? value : "invalid";
}

// "Fridge doors!" -> "fridge_doors", matching the tags in past visits.
export function normalizeTag(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^\p{L}\p{N}_]/gu, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

// "1-8, 12, 15-17" -> [1..8, 12, 15, 16, 17]. Only numbers that exist in
// the hub are allowed. Returns an error message instead if the text is bad.
export function parseShelfRange(
  text: string,
  existing: Set<number>,
): { numbers: number[] } | { error: string } {
  const parts = text.split(/[,;\s]+/).filter(Boolean);
  if (parts.length === 0) return { error: "Enter shelf numbers, e.g. 1-8, 12" };

  const numbers = new Set<number>();
  for (const part of parts) {
    const match = /^(\d+)(?:-(\d+))?$/.exec(part);
    if (!match) return { error: `"${part}" is not a shelf number or range` };
    let from = Number(match[1]);
    let to = match[2] ? Number(match[2]) : from;
    if (from > to) [from, to] = [to, from];
    for (let n = from; n <= to; n++) {
      if (!existing.has(n)) return { error: `There is no shelf ${n} in this hub` };
      numbers.add(n);
    }
  }
  return { numbers: [...numbers].sort((a, b) => a - b) };
}

// Did this shelf change compared with the last submitted visit?
// A comment always counts: it is new information for this visit.
export function isShelfChanged(
  value: ShelfValue,
  previous: { condition: Condition; score: number | null } | null,
) {
  if (!previous) return value.condition !== null || value.comment.trim() !== "";
  const score = parseScore(value.score);
  return (
    value.condition !== previous.condition ||
    (score !== "invalid" && score !== previous.score) ||
    value.comment.trim() !== ""
  );
}

// What the save action receives: only the parts that changed.
export type VisitPatch = {
  visit?: {
    manager_present?: boolean | null;
    overall_impression?: string | null;
    notes?: string | null;
    current_step?: VisitStep;
  };
  shelfUpserts: {
    shelf_id: string;
    condition: Condition;
    score_5: number | null;
    comment: string | null;
  }[];
  shelfDeletes: string[];
  staffUpserts: {
    id: string;
    staff_role: StaffRole;
    returning: boolean;
    tenure_note: string | null;
    points: string | null;
    topics: string[];
  }[];
  staffDeletes: string[];
};

export function isPatchEmpty(patch: VisitPatch) {
  return (
    !patch.visit &&
    patch.shelfUpserts.length === 0 &&
    patch.shelfDeletes.length === 0 &&
    patch.staffUpserts.length === 0 &&
    patch.staffDeletes.length === 0
  );
}

const nullIfEmpty = (s: string) => (s.trim() === "" ? null : s.trim());
const managerToDb = (m: ManagerPresent) => (m === "unknown" ? null : m === "yes");
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// Compares what was last saved with the current form and returns:
//   patch:   what to send
//   next:    what "saved" becomes once the patch succeeds
//   skipped: entries not sent because they are incomplete (bad score,
//            staff card without a role); they stay "unsaved"
export function buildPatch(
  saved: VisitFormValues,
  current: VisitFormValues,
  shelfIds: Record<string, string>,
): { patch: VisitPatch; next: VisitFormValues; skipped: number } {
  const patch: VisitPatch = {
    shelfUpserts: [],
    shelfDeletes: [],
    staffUpserts: [],
    staffDeletes: [],
  };
  const next: VisitFormValues = structuredClone(current);
  let skipped = 0;

  // Visit fields
  const visit: NonNullable<VisitPatch["visit"]> = {};
  if (saved.manager_present !== current.manager_present)
    visit.manager_present = managerToDb(current.manager_present);
  if (saved.overall_impression !== current.overall_impression)
    visit.overall_impression = nullIfEmpty(current.overall_impression);
  if (saved.notes !== current.notes) visit.notes = nullIfEmpty(current.notes);
  if (Object.keys(visit).length > 0) patch.visit = visit;

  // Shelves
  const keys = new Set([...Object.keys(saved.shelves), ...Object.keys(current.shelves)]);
  for (const key of keys) {
    const before = saved.shelves[key] ?? EMPTY_SHELF;
    const after = current.shelves[key] ?? EMPTY_SHELF;
    if (same(before, after)) continue;
    const shelfId = shelfIds[key];
    if (!shelfId) continue;

    if (after.condition === null) {
      // No condition = no check for this shelf.
      if (before.condition !== null) patch.shelfDeletes.push(shelfId);
      continue;
    }
    const score = parseScore(after.score);
    if (score === "invalid") {
      skipped++;
      next.shelves[key] = before;
      continue;
    }
    patch.shelfUpserts.push({
      shelf_id: shelfId,
      condition: after.condition,
      score_5: score,
      comment: nullIfEmpty(after.comment),
    });
  }

  // Staff feedback cards
  const savedStaff = new Map(saved.staff.map((s) => [s.id, s]));
  const currentIds = new Set(current.staff.map((s) => s.id));
  for (const card of current.staff) {
    const before = savedStaff.get(card.id);
    if (before && same(before, card)) continue;
    if (card.staff_role === null) {
      // Not saveable yet; keep whatever was saved before.
      skipped++;
      next.staff = next.staff.map((s) => (s.id === card.id ? (before ?? s) : s));
      if (!before) next.staff = next.staff.filter((s) => s.id !== card.id);
      continue;
    }
    patch.staffUpserts.push({
      id: card.id,
      staff_role: card.staff_role,
      returning: card.returning,
      tenure_note: nullIfEmpty(card.tenure_note),
      points: nullIfEmpty(card.points),
      topics: card.topics,
    });
  }
  for (const card of saved.staff) {
    if (!currentIds.has(card.id)) patch.staffDeletes.push(card.id);
  }

  return { patch, next, skipped };
}
