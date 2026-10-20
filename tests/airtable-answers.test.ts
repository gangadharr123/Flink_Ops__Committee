import { describe, expect, it } from "vitest";
import { buildAirtableAnswers, joinList, type TopicHistory } from "../src/lib/airtable/answers";
import type { ReportInput } from "../src/lib/report/model";

type Issue = ReportInput["issues"][number];

function issue(o: Partial<Issue>): Issue {
  return {
    id: o.title ?? "x",
    title: "Issue",
    category: "other",
    severity: "low",
    description: null,
    excluded: false,
    visitsSeen: 1,
    state: "still_open",
    note: null,
    photos: [],
    history: [],
    ...o,
  };
}

const input: ReportInput = {
  hubName: "Darmstadt",
  visitNumber: 3,
  visitLabel: "Visit 3",
  visitDate: "2026-10-15",
  preparedBy: null,
  managerPresent: true,
  stockAndSpace: null,
  overallImpression: null,
  shelves: [
    ...[1, 2, 3].map((n) => ({ number: n, zone: "ambient" as const, condition: "dusty" as const, score: 3, comment: "Dust on upper racks" })),
    { number: 4, zone: "ambient", condition: "clean", score: 5, comment: null },
    { number: 10, zone: "fridge", condition: "mould", score: null, comment: null },
    { number: 11, zone: "fridge", condition: "mould", score: null, comment: null },
    { number: 20, zone: "freezer", condition: "clean", score: null, comment: null },
    { number: 21, zone: "freezer", condition: "clean", score: null, comment: null },
    { number: 30, zone: "ambient", condition: null, score: null, comment: null },
  ],
  issues: [
    issue({ title: "Water filter broken", severity: "medium", visitsSeen: 3, history: [
      { visitLabel: "Visit 1", visitDate: "2026-09-18", state: "new" },
      { visitLabel: "Visit 2", visitDate: "2026-10-01", state: "still_open" },
      { visitLabel: "Visit 3", visitDate: "2026-10-15", state: "still_open" },
    ] }),
    issue({ title: "Hole in the floor", severity: "immediate", state: "new", description: "Racks lose balance — dangerous", history: [
      { visitLabel: "Visit 3", visitDate: "2026-10-15", state: "new" },
    ] }),
    issue({ title: "Fridge 13 handle", severity: "high", visitsSeen: 2, history: [
      { visitLabel: "Visit 2", visitDate: "2026-10-01", state: "new" },
      { visitLabel: "Visit 3", visitDate: "2026-10-15", state: "still_open" },
    ] }),
    issue({ title: "Mould in fridges", category: "shelf_hygiene", severity: "immediate", visitsSeen: 3, state: "improved" }),
    issue({ title: "AC leak", severity: "high", state: "resolved" }),
    issue({ title: "Hidden thing", severity: "immediate", excluded: true }),
  ],
  staff: [
    { role: "picker", returning: true, tenureNote: "About 1 month", points: null, topics: ["colleagues_positive", "fridge_mould"] },
    { role: "picker", returning: false, tenureNote: null, points: null, topics: ["water_filter"] },
    { role: "rider", returning: false, tenureNote: "3 riders, combined", points: null, topics: [] },
  ],
};

const history: TopicHistory = {
  visitsConsidered: 3,
  rows: [
    { visitId: "v1", topics: ["fridge_mould", "water_filter"] },
    { visitId: "v2", topics: ["fridge_mould", "pay"] },
    { visitId: "v3", topics: ["fridge_mould", "colleagues_positive"] },
    { visitId: "v3", topics: ["water_filter"] },
  ],
};

const answers = buildAirtableAnswers(input, history);

describe("buildAirtableAnswers", () => {
  it("summarises cleanliness with counts, ranges, scores and recurring mould", () => {
    expect(answers.cleanliness).toContain(
      "8 of 9 shelves were inspected during this visit (shelf 30 was not checked).",
    );
    expect(answers.cleanliness).toContain("3 shelves were clean and 3 were dusty (shelves 1-3).");
    expect(answers.cleanliness).toContain("Mould was found on shelves 10-11, which is a food safety risk");
    expect(answers.cleanliness).toContain("The average cleanliness score was 3.5 out of 5 across 4 scored shelves.");
    expect(answers.cleanliness).toContain("Notes from the inspection: Dust on upper racks (shelves 1-3).");
    expect(answers.cleanliness).toContain("Mould in fridges is recurring, seen on 3 visits, and remains unresolved.");
  });

  it("lists positives: clean shelves, clean zones, improved and resolved issues, positive topics", () => {
    expect(answers.positive).toContain("3 of the 8 inspected shelves were clean.");
    expect(answers.positive).toContain("Both freezer shelves were clean.");
    expect(answers.positive).toContain("One issue has improved since the last visit: Mould in fridges.");
    expect(answers.positive).toContain("One issue was resolved: AC leak.");
    expect(answers.positive).toContain("1 employee spoke positively about colleagues.");
    expect(answers.positive).toContain("The hub manager was present during the visit.");
  });

  it("lists critical issues immediate and high first, with history, skipping excluded and resolved", () => {
    const lines = answers.critical.split("\n");
    expect(lines.map((l) => l.split(" (")[0])).toEqual([
      "Mould in fridges",
      "Hole in the floor",
      "Fridge 13 handle",
      "Water filter broken",
    ]);
    expect(lines[1]).toBe(
      "Hole in the floor (immediate priority): first recorded on this visit. It was raised for the first time on this visit. Racks lose balance - dangerous.",
    );
    expect(lines[2]).toContain("first recorded on Visit 2 (1 October 2026), seen on 2 visits.");
    expect(lines[3]).toContain(
      "first recorded on Visit 1 (18 September 2026), recurring, seen on 3 visits.",
    );
    expect(answers.critical).not.toContain("Hidden thing");
    expect(answers.critical).not.toContain("AC leak");
  });

  it("counts employees spoken to by role, noting groups and returning staff", () => {
    expect(answers.employees).toContain("I spoke to 3 employees during this visit: 2 pickers and 1 rider.");
    expect(answers.employees).toContain("recorded per group rather than per person: 3 riders, combined.");
    expect(answers.employees).toContain("1 of them had also been spoken to on an earlier visit.");
    expect(answers.employees).toContain("no names were taken");
  });

  it("counts topics raised on 2 or more of the last 3 visits", () => {
    expect(answers.topics).toBe(
      "Across the last 3 visits to Darmstadt, employees raised these topics on more than one visit: fridge mould (raised 3 times across 3 visits) and water filter (raised 2 times across 2 visits).",
    );
  });

  it("handles a hub's first visit and an empty visit", () => {
    const empty = buildAirtableAnswers(
      { ...input, shelves: [], issues: [], staff: [], managerPresent: null },
      { visitsConsidered: 1, rows: [] },
    );
    expect(empty).toEqual({
      cleanliness: "No shelf inspection was recorded for this visit.",
      positive: "No specific positive observations were recorded for this visit.",
      critical: "No critical issues were observed during this visit.",
      employees: "No employees were spoken to during this visit.",
      topics:
        "This is the first visit to Darmstadt with staff feedback in HubCheck, so recurring topics cannot be identified yet.",
    });
  });

  it("has no em or en dashes anywhere", () => {
    expect(JSON.stringify(answers)).not.toMatch(/[—–]/);
  });
});

describe("joinList", () => {
  it("joins with commas and 'and'", () => {
    expect(joinList(["a"])).toBe("a");
    expect(joinList(["a", "b"])).toBe("a and b");
    expect(joinList(["a", "b", "c"])).toBe("a, b and c");
  });
});
