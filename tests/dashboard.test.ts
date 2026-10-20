import { describe, expect, it } from "vitest";
import { buildDashboard, lastMonths, type DashboardRows } from "../src/lib/dashboard/aggregate";

const rows: DashboardRows = {
  hubs: [
    { id: "d", name: "Darmstadt" },
    { id: "m", name: "Mainz" },
  ],
  visits: [
    { id: "d1", hub_id: "d", visit_number: 1, label: "Visit 1", visit_date: "2026-09-18", status: "submitted" },
    { id: "d2", hub_id: "d", visit_number: 2, label: "Visit 2", visit_date: "2026-10-01", status: "submitted" },
    { id: "d3", hub_id: "d", visit_number: 3, label: "Visit 3", visit_date: "2026-10-15", status: "draft" },
    { id: "m1", hub_id: "m", visit_number: 1, label: "Visit 1", visit_date: "2026-09-04", status: "submitted" },
  ],
  issues: [
    { id: "a", hub_id: "d", title: "Mould", severity: "immediate", status: "open", exclude_from_outputs: false, first_seen_visit_id: "d1", resolved_visit_id: null },
    { id: "b", hub_id: "d", title: "Filter", severity: "medium", status: "open", exclude_from_outputs: false, first_seen_visit_id: "d1", resolved_visit_id: null },
    { id: "c", hub_id: "d", title: "AC leak", severity: "high", status: "resolved", exclude_from_outputs: false, first_seen_visit_id: "d1", resolved_visit_id: "d2" },
    { id: "e", hub_id: "d", title: "Hidden", severity: "immediate", status: "open", exclude_from_outputs: true, first_seen_visit_id: "d1", resolved_visit_id: null },
    { id: "f", hub_id: "d", title: "Draft only", severity: "low", status: "open", exclude_from_outputs: false, first_seen_visit_id: "d3", resolved_visit_id: null },
    { id: "g", hub_id: "m", title: "Door", severity: "high", status: "open", exclude_from_outputs: false, first_seen_visit_id: null, resolved_visit_id: null },
  ],
  stats: [
    { issue_id: "a", visits_seen: 3, is_recurring: true, days_open: 32 },
    { issue_id: "b", visits_seen: 2, is_recurring: false, days_open: 32 },
    { issue_id: "g", visits_seen: 1, is_recurring: false, days_open: 50 },
  ],
  shelfChecks: [
    { visit_id: "d1", condition: "clean" },
    { visit_id: "d1", condition: "minor_dust" },
    { visit_id: "d1", condition: "dusty" },
    { visit_id: "d1", condition: "mould" },
    { visit_id: "d3", condition: "mould" },
  ],
  feedback: [
    { visit_id: "d1", topics: ["fridge_mould", "pay"] },
    { visit_id: "d2", topics: ["fridge_mould"] },
    { visit_id: "m1", topics: ["fridge_mould", "pay", "pay"] },
    { visit_id: "d3", topics: ["helmets"] },
  ],
};

const dash = buildDashboard(rows, "2026-10-20");

describe("buildDashboard", () => {
  it("counts open issues per hub by severity, skipping hidden and draft-only issues", () => {
    expect(dash.openBySeverity).toEqual([
      { hub: "Darmstadt", immediate: 1, high: 0, medium: 1, low: 0 },
      { hub: "Mainz", immediate: 0, high: 1, medium: 0, low: 0 },
    ]);
    expect(dash.kpis).toEqual({ open: 3, immediateOpen: 1, recurringOpen: 1, visitsThisMonth: 1 });
  });

  it("lists the oldest open issues first, then the most severe", () => {
    expect(dash.oldestOpen.map((i) => i.title)).toEqual(["Door", "Mould", "Filter"]);
    expect(dash.oldestOpen[1]).toMatchObject({ hub: "Darmstadt", daysOpen: 32, visitsSeen: 3, isRecurring: true });
  });

  it("counts shelf conditions per submitted visit; minor dust counts as dusty", () => {
    expect(dash.shelfByVisit[0]).toEqual({
      hub: "Darmstadt",
      visits: [
        { label: "Visit 1", date: "2026-09-18", clean: 1, dusty: 2, mould: 1 },
        { label: "Visit 2", date: "2026-10-01", clean: 0, dusty: 0, mould: 0 },
      ],
    });
  });

  it("ranks topics raised on 2+ submitted visits", () => {
    expect(dash.topTopics).toEqual([
      { topic: "fridge mould", visits: 3, times: 3 },
      { topic: "pay", visits: 2, times: 2 },
    ]);
  });

  it("counts issues resolved per month by the resolving visit's date", () => {
    expect(dash.resolvedPerMonth).toHaveLength(12);
    expect(dash.resolvedPerMonth.at(-1)).toEqual({
      month: "2026-10",
      label: "Oct 26",
      counts: { Darmstadt: 1, Mainz: 0 },
    });
  });
});

describe("lastMonths", () => {
  it("returns 12 months ending this month, across a year boundary", () => {
    const months = lastMonths("2026-02-10");
    expect(months[0].key).toBe("2025-03");
    expect(months.at(-1)!.key).toBe("2026-02");
  });
});
