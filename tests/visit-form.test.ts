import { describe, expect, it } from "vitest";
import {
  buildPatch,
  isPatchEmpty,
  isShelfChanged,
  normalizeTag,
  parseScore,
  parseShelfRange,
  type VisitFormValues,
} from "../src/lib/visit-form";

describe("parseScore", () => {
  it("accepts dots, German commas and empty", () => {
    expect(parseScore("3.75")).toBe(3.75);
    expect(parseScore("3,5")).toBe(3.5);
    expect(parseScore(" 5 ")).toBe(5);
    expect(parseScore("")).toBeNull();
  });
  it("rejects out of range and junk", () => {
    expect(parseScore("5.5")).toBe("invalid");
    expect(parseScore("6")).toBe("invalid");
    expect(parseScore("3.333")).toBe("invalid");
    expect(parseScore("abc")).toBe("invalid");
  });
});

describe("parseShelfRange", () => {
  const shelves = new Set(Array.from({ length: 70 }, (_, i) => i + 1));
  it("expands ranges and single numbers", () => {
    expect(parseShelfRange("1-3, 12 15-16", shelves)).toEqual({
      numbers: [1, 2, 3, 12, 15, 16],
    });
  });
  it("accepts reversed ranges", () => {
    expect(parseShelfRange("3-1", shelves)).toEqual({ numbers: [1, 2, 3] });
  });
  it("rejects shelves the hub doesn't have, and junk", () => {
    expect(parseShelfRange("69-71", shelves)).toEqual({
      error: "There is no shelf 71 in this hub",
    });
    expect(parseShelfRange("1-x", shelves)).toHaveProperty("error");
    expect(parseShelfRange("  ", shelves)).toHaveProperty("error");
  });
});

describe("normalizeTag", () => {
  it("matches the snake_case style of existing tags", () => {
    expect(normalizeTag("  Fridge doors! ")).toBe("fridge_doors");
    expect(normalizeTag("bike-room")).toBe("bike_room");
    expect(normalizeTag("Pfand Flaschen ä")).toBe("pfand_flaschen_ä");
  });
});

describe("isShelfChanged", () => {
  const prev = { condition: "dusty" as const, score: 3 };
  it("compares condition and score with the previous visit", () => {
    expect(isShelfChanged({ condition: "dusty", score: "3", comment: "" }, prev)).toBe(false);
    expect(isShelfChanged({ condition: "clean", score: "3", comment: "" }, prev)).toBe(true);
    expect(isShelfChanged({ condition: "dusty", score: "4", comment: "" }, prev)).toBe(true);
  });
  it("counts a new comment as a change", () => {
    expect(isShelfChanged({ condition: "dusty", score: "3", comment: "x" }, prev)).toBe(true);
  });
  it("without a previous check, changed once a condition is set", () => {
    expect(isShelfChanged({ condition: null, score: "", comment: "" }, null)).toBe(false);
    expect(isShelfChanged({ condition: "clean", score: "", comment: "" }, null)).toBe(true);
  });
});

describe("buildPatch", () => {
  const base: VisitFormValues = {
    manager_present: "unknown",
    stock_and_space: "",
    overall_impression: "",
    notes: "",
    shelves: { n1: { condition: "dusty", score: "3", comment: "" } },
    staff: [],
    issues: {},
  };
  const ids = { n1: "shelf-1", n2: "shelf-2" };

  it("is empty when nothing changed", () => {
    expect(isPatchEmpty(buildPatch(base, structuredClone(base), ids).patch)).toBe(true);
  });

  it("sends only changed fields, with blanks as null", () => {
    const current = structuredClone(base);
    current.manager_present = "yes";
    current.notes = "  ";
    current.shelves.n2 = { condition: "mould", score: "2,5", comment: " trays " };
    const { patch } = buildPatch(base, current, ids);
    expect(patch.visit).toEqual({ manager_present: true, notes: null });
    expect(patch.shelfUpserts).toEqual([
      { shelf_id: "shelf-2", condition: "mould", score_5: 2.5, comment: "trays" },
    ]);
  });

  it("deletes a shelf check when its condition is cleared", () => {
    const current = structuredClone(base);
    current.shelves.n1 = { condition: null, score: "", comment: "" };
    expect(buildPatch(base, current, ids).patch.shelfDeletes).toEqual(["shelf-1"]);
  });

  it("skips a bad score and keeps it unsaved", () => {
    const current = structuredClone(base);
    current.shelves.n1.score = "9";
    const { patch, next, skipped } = buildPatch(base, current, ids);
    expect(patch.shelfUpserts).toEqual([]);
    expect(skipped).toBe(1);
    expect(next.shelves.n1.score).toBe("3");
  });

  it("waits for a staff role, then upserts; removed cards are deleted", () => {
    const card = {
      id: "card-1",
      staff_role: null,
      returning: false,
      tenure_note: "",
      points: "Likes the team",
      topics: ["colleagues_positive"],
    };
    const noRole = buildPatch(base, { ...base, staff: [card] }, ids);
    expect(noRole.patch.staffUpserts).toEqual([]);
    expect(noRole.next.staff).toEqual([]);

    const withRole = { ...card, staff_role: "picker" as const };
    const added = buildPatch(base, { ...base, staff: [withRole] }, ids);
    expect(added.patch.staffUpserts[0]).toMatchObject({ id: "card-1", staff_role: "picker" });

    const removed = buildPatch(added.next, base, ids);
    expect(removed.patch.staffDeletes).toEqual(["card-1"]);
  });

  it("upserts issue updates, deletes cleared ones, holds a note without a state", async () => {
    const key = "i_issue-1";
    const set = buildPatch(
      base,
      { ...base, issues: { [key]: { state: "improved", note: " better " } } },
      ids,
    );
    expect(set.patch.issueUpserts).toEqual([
      { issue_id: "issue-1", state: "improved", note: "better" },
    ]);

    const cleared = buildPatch(set.next, { ...base, issues: { [key]: { state: null, note: "" } } }, ids);
    expect(cleared.patch.issueDeletes).toEqual(["issue-1"]);

    const noteOnly = buildPatch(base, { ...base, issues: { [key]: { state: null, note: "hm" } } }, ids);
    expect(noteOnly.patch.issueUpserts).toEqual([]);
    expect(noteOnly.skipped).toBe(1);
  });
});
