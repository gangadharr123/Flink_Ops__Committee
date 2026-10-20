// The canvas part needs a browser; this checks the sizing rules.
import { describe, expect, it } from "vitest";
import { ATTEMPTS, fitWithin } from "../src/lib/compress-image";

describe("fitWithin", () => {
  it("scales the long side down to the limit, keeping the shape", () => {
    expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 });
  });
  it("never enlarges small photos", () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
});

describe("compression attempts", () => {
  it("only get smaller or lower quality, so each try is no bigger than the last", () => {
    for (let i = 1; i < ATTEMPTS.length; i++) {
      const prev = ATTEMPTS[i - 1];
      const cur = ATTEMPTS[i];
      expect(
        cur.maxSide < prev.maxSide ||
          (cur.maxSide === prev.maxSide && cur.quality < prev.quality),
      ).toBe(true);
    }
  });
});
