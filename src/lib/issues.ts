// Issue helpers shared by pages, report builders and tests. Pure: no
// Supabase here.
import type { Enums } from "@/lib/database.types";

export type Severity = Enums<"issue_severity">;
export type IssueCategory = Enums<"issue_category">;
export type IssueUpdateState = Enums<"issue_update_state">;

// "Recurring" = seen on 3 or more visits (CLAUDE.md).
// Keep in sync with public.recurring_min_visits() in the issues migration.
export const RECURRING_MIN_VISITS = 3;

// Visits where the issue was present. A "resolved" update means it was gone.
export function visitsSeen(updates: { visit_id: string; state: IssueUpdateState }[]) {
  return new Set(updates.filter((u) => u.state !== "resolved").map((u) => u.visit_id)).size;
}

// Per issue: is it recurring? Takes each issue's updates and returns
// { issueId: { visitsSeen, isRecurring } }.
export function recurrenceByIssue(
  updates: { issue_id: string; visit_id: string; state: IssueUpdateState }[],
) {
  const byIssue = new Map<string, typeof updates>();
  for (const u of updates) {
    byIssue.set(u.issue_id, [...(byIssue.get(u.issue_id) ?? []), u]);
  }
  const result: Record<string, { visitsSeen: number; isRecurring: boolean }> = {};
  for (const [issueId, list] of byIssue) {
    const seen = visitsSeen(list);
    result[issueId] = { visitsSeen: seen, isRecurring: seen >= RECURRING_MIN_VISITS };
  }
  return result;
}

// Wording used everywhere, including reports: "recurring, seen on 4 visits".
export function recurringLabel(visits: number) {
  return `recurring, seen on ${visits} visits`;
}

export const SEVERITIES: { value: Severity; label: string }[] = [
  { value: "immediate", label: "Immediate" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

// immediate first
export const SEVERITY_RANK: Record<Severity, number> = {
  immediate: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const UPDATE_STATES: { value: IssueUpdateState; label: string }[] = [
  { value: "new", label: "New" },
  { value: "still_open", label: "Still open" },
  { value: "improved", label: "Improved" },
  { value: "resolved", label: "Resolved" },
];

export const CATEGORY_LABELS: Record<IssueCategory, string> = {
  ac_leaks: "AC leaks",
  app_routing: "App / routing",
  batteries_chargers: "Batteries / chargers",
  bike_room: "Bike room",
  floor: "Floor",
  fridge_freezer_equipment: "Fridge / freezer equipment",
  other: "Other",
  process: "Process",
  rider_safety_gear: "Rider safety gear",
  riders_room: "Riders' room",
  shelf_hygiene: "Shelf hygiene",
  staff_welfare: "Staff welfare",
  water_filter: "Water filter",
};
