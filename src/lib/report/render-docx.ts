import "server-only";
import {
  AlignmentType,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
  UnderlineType,
  type ParagraphChild,
} from "docx";
import type { Block, Emphasis, Report } from "./model";

// Look of docs/sample-report.docx (Darmstadt Visit 3), plus CLAUDE.md:
// Calibri, 10 pt body, numbered underlined headings, "- " bullets, red urgent.
const FONT = "Calibri";
const BODY_SIZE = 20; // docx sizes are half-points: 20 = 10 pt
const HEADING_SIZE = 22; // 11 pt
const RED = "CC0000";

// A4 with the sample's margins (twips: 1440 = 1 inch).
const PAGE = { width: 11906, height: 16838 };
const MARGIN = { top: 1440, bottom: 1440, left: 1727, right: 1727 };

// Photos: up to 3 side by side, sized in pixels (96 per inch).
const PHOTO_WIDTH = 180;
const PHOTO_MAX_HEIGHT = 240;
const PHOTOS_PER_ROW = 3;

function runs(text: string, emphasis: Emphasis, prefix = ""): TextRun[] {
  return [
    new TextRun({
      text: prefix + text,
      bold: emphasis !== "normal",
      color: emphasis === "urgent" ? RED : undefined,
    }),
  ];
}

function photoRows(
  photos: { path: string; caption: string | null }[],
  images: Map<string, Buffer>,
): Paragraph[] {
  const loaded = photos.flatMap((p) => {
    const data = images.get(p.path);
    const size = data && jpegSize(data);
    return data && size ? [{ ...p, data, size }] : [];
  });
  const rows: Paragraph[] = [];
  for (let i = 0; i < loaded.length; i += PHOTOS_PER_ROW) {
    const children: ParagraphChild[] = [];
    loaded.slice(i, i + PHOTOS_PER_ROW).forEach((photo, j) => {
      if (j > 0) children.push(new TextRun({ text: "  " }));
      let width = PHOTO_WIDTH;
      let height = Math.round((photo.size.height / photo.size.width) * width);
      if (height > PHOTO_MAX_HEIGHT) {
        width = Math.round((PHOTO_MAX_HEIGHT / height) * width);
        height = PHOTO_MAX_HEIGHT;
      }
      children.push(
        new ImageRun({
          type: "jpg",
          data: photo.data,
          transformation: { width, height },
          altText: { name: "Photo", description: photo.caption ?? "Issue photo", title: "Photo" },
        }),
      );
    });
    rows.push(new Paragraph({ children, spacing: { before: 120, after: 120 } }));
  }
  return rows;
}

function toParagraphs(block: Block, images: Map<string, Buffer>): Paragraph[] {
  switch (block.kind) {
    case "heading":
      return [
        new Paragraph({
          spacing: { before: 280, after: 120 },
          keepNext: true,
          children: [
            new TextRun({
              text: `${block.number}. ${block.text}`,
              bold: true,
              underline: { type: UnderlineType.SINGLE },
              size: HEADING_SIZE,
            }),
          ],
        }),
      ];
    case "label":
      return [
        new Paragraph({
          spacing: { before: 120, after: 40 },
          keepNext: true,
          children: runs(block.text, block.emphasis === "normal" ? "bold" : block.emphasis),
        }),
      ];
    case "bullet":
      // Dash bullets are typed text, as in the sample, not Word list bullets.
      return [
        new Paragraph({
          spacing: { after: 60 },
          children: runs(block.text, block.emphasis, "- "),
        }),
      ];
    case "text":
      return [new Paragraph({ spacing: { after: 80 }, children: runs(block.text, "normal") })];
    case "photos":
      return photoRows(block.photos, images);
  }
}

// images: storage path -> JPEG bytes (already downloaded by the caller).
export async function renderReportDocx(
  report: Report,
  images: Map<string, Buffer> = new Map(),
): Promise<Buffer> {
  const doc = new Document({
    creator: "HubCheck",
    title: report.title,
    styles: {
      default: {
        document: { run: { font: FONT, size: BODY_SIZE } },
      },
    },
    sections: [
      {
        properties: { page: { size: PAGE, margin: MARGIN } },
        children: [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { after: 80 },
            children: [new TextRun({ text: report.title, size: 52 })], // 26 pt
          }),
          new Paragraph({
            spacing: { after: 240 },
            children: [new TextRun({ text: report.subtitle })],
          }),
          ...report.blocks.flatMap((b) => toParagraphs(b, images)),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

// Width and height of a JPEG, read from its header (SOF marker), so photos
// keep their shape in the report. Returns null if it isn't a readable JPEG.
export function jpegSize(data: Buffer): { width: number; height: number } | null {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < data.length) {
    if (data[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = data[i + 1];
    const length = data.readUInt16BE(i + 2);
    // SOF0-SOF15, except DHT (C4), JPG (C8) and DAC (CC)
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: data.readUInt16BE(i + 5), width: data.readUInt16BE(i + 7) };
    }
    i += 2 + length;
  }
  return null;
}
