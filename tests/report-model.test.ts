import { describe, expect, it } from "vitest";
import {
  buildReport,
  formatRanges,
  noDashes,
  type Block,
  type ReportInput,
} from "../src/lib/report/model";

function input(overrides: Partial<ReportInput> = {}): ReportInput {
  return {
    hubName: "Darmstadt",
    visitNumber: 3,
    visitLabel: "Visit 3",
    visitDate: "2026-10-15",
    preparedBy: "Test Inspector",
    managerPresent: true,
    stockAndSpace: "Stock organisation adequate\nNo overstocking",
    overallImpression: "Hub is functioning — team engaged",
    shelves: [
      ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
        number: n,
        zone: "ambient" as const,
        condition: "dusty" as const,
        score: 3.5,
        comment: "Dust on upper racks",
      })),
      { number: 9, zone: "ambient", condition: "clean", score: null, comment: null },
      { number: 10, zone: "fridge", condition: "mould", score: null, comment: null },
      { number: 11, zone: "fridge", condition: "mould", score: null, comment: null },
      { number: 12, zone: "ambient", condition: null, score: null, comment: null },
    ],
    issues: [
      issue({ title: "Water filter broken", category: "water_filter", severity: "medium", visitsSeen: 3, state: "still_open" }),
      issue({ title: "Hole in floor", category: "floor", severity: "immediate", visitsSeen: 1, state: "new", description: "Racks tip over" }),
      issue({ title: "AC leak", category: "ac_leaks", severity: "high", visitsSeen: 2, state: "resolved" }),
      issue({ title: "Secret thing", category: "other", severity: "immediate", excluded: true }),
    ],
    staff: [
      { role: "picker", returning: false, tenureNote: "about 1 month", points: "Likes the team\nFridge 13 handle broken" },
      { role: "picker", returning: true, tenureNote: null, points: "" },
      { role: "rider", returning: false, tenureNote: null, points: "Needs helmets" },
    ],
    ...overrides,
  };
}

function issue(o: Partial<ReportInput["issues"][number]>): ReportInput["issues"][number] {
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
    ...o,
  };
}

const headings = (blocks: Block[]) =>
  blocks.filter((b) => b.kind === "heading").map((b) => `${b.number}. ${b.text}`);

// All text after a heading, up to the next heading.
function section(blocks: Block[], title: string) {
  const start = blocks.findIndex((b) => b.kind === "heading" && b.text === title);
  const rest = blocks.slice(start + 1);
  const end = rest.findIndex((b) => b.kind === "heading");
  return end === -1 ? rest : rest.slice(0, end);
}

describe("formatRanges / noDashes", () => {
  it("merges neighbouring numbers", () => {
    expect(formatRanges([5, 1, 2, 3, 8, 7])).toBe("1-3, 5, 7-8");
  });
  it("removes em and en dashes", () => {
    expect(noDashes("a — b – c")).toBe("a - b - c");
  });
});

describe("buildReport", () => {
  const report = buildReport(input());

  it("has the title block and file name", () => {
    expect(report.title).toBe("Darmstadt Hub - Visit Report");
    expect(report.subtitle).toBe("Visit 3  |  15 October 2026  |  Prepared by Test Inspector");
    expect(report.fileName).toBe("Darmstadt_Visit_3_2026-10-15.docx");
  });

  it("numbers sections in order, one per issue category, most severe first", () => {
    expect(headings(report.blocks)).toEqual([
      "1. Stock and Space Utilisation",
      "2. Shelf Conditions",
      "3. Floor",
      "4. AC Leaks",
      "5. Water Filter",
      "6. Staff Feedback",
      "7. Overall Impression",
      "8. Priority Actions",
    ]);
  });

  it("groups shelves by zone and merges ranges; mould is urgent", () => {
    const shelves = section(report.blocks, "Shelf Conditions");
    expect(shelves).toContainEqual({ kind: "label", text: "Fridges:", emphasis: "bold" });
    expect(shelves).toContainEqual({
      kind: "bullet",
      text: "Shelves 10-11: mould.",
      emphasis: "urgent",
    });
    expect(shelves).toContainEqual({
      kind: "bullet",
      text: "Shelves 1-8: dusty, 3.5/5. Dust on upper racks.",
      emphasis: "normal",
    });
    expect(shelves).toContainEqual({ kind: "bullet", text: "Shelf 9: clean.", emphasis: "normal" });
    expect(shelves).toContainEqual({ kind: "bullet", text: "Shelf 12.", emphasis: "normal" });
    // Same finding, not neighbours: still one line.
    const spread = buildReport(
      input({
        shelves: [1, 2, 5, 9].map((n) => ({
          number: n,
          zone: "fridge" as const,
          condition: "mould" as const,
          score: null,
          comment: null,
        })),
      }),
    );
    expect(section(spread.blocks, "Shelf Conditions")).toContainEqual({
      kind: "bullet",
      text: "Shelves 1-2, 5, 9: mould.",
      emphasis: "urgent",
    });
    // Fridges come before ambient.
    const labels = shelves.filter((b) => b.kind === "label").map((b) => b.kind === "label" && b.text);
    expect(labels).toEqual(["Fridges:", "Ambient:", "Not checked:"]);
  });

  it("marks immediate red and bold, and says recurring with the count", () => {
    expect(section(report.blocks, "Floor")).toContainEqual({
      kind: "bullet",
      text: "Hole in floor: New on this visit. Racks tip over.",
      emphasis: "urgent",
    });
    expect(section(report.blocks, "Water Filter")).toContainEqual({
      kind: "bullet",
      text: "Water filter broken: Still open. (recurring, seen on 3 visits)",
      emphasis: "normal",
    });
  });

  it("skips issues marked exclude_from_outputs everywhere", () => {
    const all = JSON.stringify(report);
    expect(all).not.toContain("Secret thing");
    expect(headings(report.blocks)).not.toContain("Other");
  });

  it("sorts Priority Actions by severity and leaves out resolved issues", () => {
    expect(section(report.blocks, "Priority Actions")).toEqual([
      { kind: "bullet", text: "IMMEDIATE: Hole in floor.", emphasis: "urgent" },
      {
        kind: "bullet",
        text: "Water filter broken. (recurring, seen on 3 visits)",
        emphasis: "normal",
      },
    ]);
  });

  it("lists staff by role with tenure, numbering people of the same role", () => {
    const staff = section(report.blocks, "Staff Feedback");
    const labels = staff.filter((b) => b.kind === "label").map((b) => b.kind === "label" && b.text);
    expect(labels).toEqual(["Picker 1 (about 1 month):", "Picker 2 (returning):", "Rider:"]);
    expect(staff).toContainEqual({ kind: "bullet", text: "Fridge 13 handle broken.", emphasis: "normal" });
  });

  it("has no em or en dashes anywhere, even from typed text", () => {
    expect(JSON.stringify(report)).not.toMatch(/[—–]/);
    expect(section(report.blocks, "Overall Impression")).toContainEqual({
      kind: "bullet",
      text: "Hub is functioning - team engaged.",
      emphasis: "normal",
    });
  });

  it("drops empty sections and renumbers", () => {
    const bare = buildReport(input({ stockAndSpace: null, issues: [], staff: [] }));
    expect(headings(bare.blocks)).toEqual([
      "1. Shelf Conditions",
      "2. Overall Impression",
    ]);
  });
});
