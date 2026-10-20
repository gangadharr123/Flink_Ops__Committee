// Renders a real .docx and checks what Word will see inside it.
import JSZip from "jszip";
import { beforeAll, describe, expect, it } from "vitest";
import { buildReport, type ReportInput } from "../src/lib/report/model";
import { jpegSize, renderReportDocx } from "../src/lib/report/render-docx";

// The smallest valid JPEG (1x1 pixel).
const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64",
);

const input: ReportInput = {
  hubName: "Mainz",
  visitNumber: 4,
  visitLabel: "Visit 4",
  visitDate: "2026-10-07",
  preparedBy: "Test Inspector",
  managerPresent: null,
  stockAndSpace: "Back stock room — excellent",
  overallImpression: "Very good – strong team",
  shelves: [
    { number: 1, zone: "ambient", condition: "clean", score: 4.5, comment: null },
    { number: 2, zone: "fridge", condition: "mould", score: null, comment: "Trays — mould" },
  ],
  issues: [
    {
      id: "a",
      title: "Door stopper missing",
      category: "bike_room",
      severity: "immediate",
      description: "Rope used — temporary",
      excluded: false,
      visitsSeen: 4,
      state: "still_open",
      note: null,
      photos: [{ path: "v/a.jpg", caption: null }],
    },
  ],
  staff: [{ role: "rider", returning: false, tenureNote: null, points: "Bags get damaged" }],
};

let documentXml = "";
let stylesXml = "";
let mediaCount = 0;

beforeAll(async () => {
  const file = await renderReportDocx(buildReport(input), new Map([["v/a.jpg", TINY_JPEG]]));
  const zip = await JSZip.loadAsync(file);
  documentXml = await zip.file("word/document.xml")!.async("string");
  stylesXml = await zip.file("word/styles.xml")!.async("string");
  mediaCount = Object.values(zip.files).filter(
    (f) => !f.dir && f.name.startsWith("word/media/"),
  ).length;
});

describe("renderReportDocx", () => {
  it("uses Calibri 10 pt as the body default", () => {
    expect(stylesXml).toContain('w:ascii="Calibri"');
    expect(stylesXml).toMatch(/<w:sz w:val="20"\/>/);
  });

  it("writes numbered, bold, underlined headings", () => {
    expect(documentXml).toContain("1. Stock and Space Utilisation");
    expect(documentXml).toMatch(/<w:u w:val="single"\/>/);
  });

  it("writes dash bullets and red urgent text", () => {
    expect(documentXml).toContain("- Shelf 2: mould.");
    expect(documentXml).toContain('w:val="CC0000"');
    expect(documentXml).toContain("IMMEDIATE: Door stopper missing. (recurring, seen on 4 visits)");
  });

  it("contains no em or en dashes anywhere", () => {
    expect(documentXml).not.toMatch(/[—–]/);
    expect(documentXml).not.toContain("&#8212;");
  });

  it("embeds the issue photo", () => {
    expect(mediaCount).toBe(1);
  });
});

describe("jpegSize", () => {
  it("reads width and height from the JPEG header", () => {
    expect(jpegSize(TINY_JPEG)).toEqual({ width: 1, height: 1 });
    expect(jpegSize(Buffer.from("not a jpeg"))).toBeNull();
  });
});
