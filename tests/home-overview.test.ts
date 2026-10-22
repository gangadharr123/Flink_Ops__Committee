import { describe, expect, it } from "vitest";
import { buildHubOverview } from "../src/lib/home/overview";

const issue = (o: Record<string, unknown>) => ({
  hub_id: "d",
  severity: "high" as const,
  status: "open" as const,
  exclude_from_outputs: false,
  first_seen_visit_id: "d1",
  resolved_visit_id: null,
  ...o,
}) as never;

const rows = {
  hubs: [
    { id: "d", name: "Darmstadt" },
    { id: "m", name: "Mainz" },
  ],
  visits: [
    { id: "d1", hub_id: "d", visit_number: 1, label: "Visit 1", visit_date: "2026-09-18", status: "submitted" as const },
    { id: "d2", hub_id: "d", visit_number: 2, label: null, visit_date: "2026-10-15", status: "submitted" as const },
    { id: "d3", hub_id: "d", visit_number: 3, label: null, visit_date: "2026-10-21", status: "draft" as const },
    { id: "m1", hub_id: "m", visit_number: 1, label: "Trial shift", visit_date: "2026-09-04", status: "submitted" as const },
  ],
  issues: [
    issue({ id: "a", title: "Hole in floor", severity: "immediate" }),
    issue({ id: "b", title: "Water filter", severity: "medium" }),
    issue({ id: "c", title: "Hidden", severity: "immediate", exclude_from_outputs: true }),
    issue({ id: "e", title: "Draft only", severity: "immediate", first_seen_visit_id: "d3" }),
    issue({ id: "f", title: "Resolved", severity: "immediate", status: "resolved" }),
  ],
  stats: [
    { issue_id: "a", visits_seen: 1, is_recurring: false, days_open: 6 },
    { issue_id: "b", visits_seen: 3, is_recurring: true, days_open: 33 },
  ],
};

describe("buildHubOverview", () => {
  const [darmstadt, mainz] = buildHubOverview(rows, "2026-10-22");

  it("shows the last submitted visit and days since", () => {
    expect(darmstadt.lastVisit).toEqual({ id: "d2", label: "Visit 2", date: "2026-10-15", daysSince: 7 });
    expect(darmstadt.visitedThisMonth).toBe(true);
  });

  it("counts open immediate issues, skipping hidden, draft-only and resolved ones", () => {
    expect(darmstadt.openImmediate).toBe(1);
  });

  it("finds the oldest open issue", () => {
    expect(darmstadt.oldestOpen).toEqual({ id: "b", title: "Water filter", severity: "medium", daysOpen: 33 });
  });

  it("offers the draft to continue", () => {
    expect(darmstadt.draft).toEqual({ id: "d3", label: "Visit 3" });
    expect(mainz.draft).toBeNull();
  });

  it("marks a hub without a visit this month as due", () => {
    expect(mainz.visitedThisMonth).toBe(false);
    expect(mainz.lastVisit?.daysSince).toBe(48);
    expect(mainz.openImmediate).toBe(0);
    expect(mainz.oldestOpen).toBeNull();
  });
});
