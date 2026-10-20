// Builds the visit report as plain data: a title and a list of blocks
// (headings, bold labels, bullets, photos). No Word code here, so it is easy
// to test and can be reused for the Airtable text. render-docx.ts turns it
// into a .docx. Style rules come from CLAUDE.md and docs/sample-report.docx.
import { formatLongDate } from "@/lib/format";
import {
  CATEGORY_LABELS,
  recurringLabel,
  RECURRING_MIN_VISITS,
  SEVERITY_RANK,
  type IssueCategory,
  type IssueUpdateState,
  type Severity,
} from "@/lib/issues";
import {
  CONDITIONS,
  STAFF_ROLES,
  ZONE_ORDER,
  type Condition,
  type StaffRole,
  type Zone,
} from "@/lib/visit-form";

// ---- input --------------------------------------------------------------

export type ReportInput = {
  hubName: string;
  visitNumber: number;
  visitLabel: string;
  visitDate: string; // YYYY-MM-DD
  preparedBy: string | null;
  managerPresent: boolean | null;
  stockAndSpace: string | null;
  overallImpression: string | null;
  shelves: {
    number: number;
    zone: Zone;
    condition: Condition | null; // null = not checked
    score: number | null;
    comment: string | null;
  }[];
  // issues with an update on this visit
  issues: {
    id: string;
    title: string;
    category: IssueCategory;
    severity: Severity;
    description: string | null;
    excluded: boolean;
    visitsSeen: number;
    state: IssueUpdateState; // this visit's update
    note: string | null;
    photos: { path: string; caption: string | null }[];
  }[];
  staff: {
    role: StaffRole;
    returning: boolean;
    tenureNote: string | null;
    points: string | null;
  }[];
};

// ---- output -------------------------------------------------------------

// normal; bold; urgent = red and bold (immediate items, mould)
export type Emphasis = "normal" | "bold" | "urgent";

export type Block =
  | { kind: "heading"; number: number; text: string }
  | { kind: "label"; text: string; emphasis: Emphasis } // e.g. "Fridges:"
  | { kind: "bullet"; text: string; emphasis: Emphasis } // rendered as "- text"
  | { kind: "text"; text: string }
  | { kind: "photos"; photos: { path: string; caption: string | null }[] };

export type Report = {
  title: string;
  subtitle: string;
  fileName: string;
  blocks: Block[];
};

// ---- text helpers -------------------------------------------------------

// CLAUDE.md: no em dashes anywhere. En dashes go too, for consistency.
export function noDashes(text: string) {
  return text.replace(/\s*[—–]\s*/g, " - ").trim();
}

// Ends a phrase with a full stop unless it already has punctuation.
export function sentence(text: string) {
  const t = text.trim();
  return t === "" || /[.!?:)]$/.test(t) ? t : `${t}.`;
}

// Each non-empty line of a text box becomes one bullet.
function lines(text: string | null) {
  return (text ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean);
}

// "Fridge / freezer equipment" -> "Fridge / Freezer Equipment", as headings
// in the sample report. Short joining words and "AC" stay as they are.
export function titleCase(text: string) {
  return text
    .split(" ")
    .map((word, i) =>
      i > 0 && ["and", "of", "or", "the"].includes(word)
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

// [1,2,3,5,7,8] -> "1-3, 5, 7-8"
export function formatRanges(numbers: number[]) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i];
    while (sorted[i + 1] === sorted[i] + 1) i++;
    parts.push(start === sorted[i] ? `${start}` : `${start}-${sorted[i]}`);
  }
  return parts.join(", ");
}

const conditionText = (c: Condition) =>
  (CONDITIONS.find((x) => x.value === c)?.label ?? c).toLowerCase();

// ---- sections -----------------------------------------------------------

type Section = { title: string; blocks: Block[] };

function stockSection(input: ReportInput): Section {
  return {
    title: "Stock and Space Utilisation",
    blocks: lines(input.stockAndSpace).map((l) => bullet(sentence(l))),
  };
}

// Shelves grouped by zone. Within a zone, shelves with the same condition,
// score and comment share one line, with ranges merged:
// "Shelves 10-13, 33-35, 37: mould." Lines are ordered by their first shelf.
function shelfSection(input: ReportInput): Section {
  const checked = input.shelves.filter((s) => s.condition !== null);
  const blocks: Block[] = [];
  if (checked.length === 0) return { title: "Shelf Conditions", blocks };

  blocks.push({
    kind: "text",
    text:
      checked.length === input.shelves.length
        ? `All ${input.shelves.length} shelves were checked. Findings by zone:`
        : `${checked.length} of ${input.shelves.length} shelves were checked. Findings by zone:`,
  });

  for (const { zone, label } of ZONE_ORDER) {
    const inZone = checked
      .filter((s) => s.zone === zone)
      .sort((a, b) => a.number - b.number);
    if (inZone.length === 0) continue;
    blocks.push({ kind: "label", text: `${label}:`, emphasis: "bold" });

    // Group by finding; Map keeps the order of each finding's first shelf.
    const groups = new Map<string, typeof inZone>();
    for (const shelf of inZone) {
      const finding = JSON.stringify([shelf.condition, shelf.score, (shelf.comment ?? "").trim()]);
      groups.set(finding, [...(groups.get(finding) ?? []), shelf]);
    }
    for (const group of groups.values()) {
      const first = group[0];
      const numbers = group.map((s) => s.number);
      const name = numbers.length === 1 ? `Shelf ${numbers[0]}` : `Shelves ${formatRanges(numbers)}`;
      let text = `${name}: ${conditionText(first.condition!)}`;
      if (first.score !== null) text += `, ${first.score}/5`;
      text = sentence(text);
      if (first.comment?.trim()) text += ` ${sentence(first.comment)}`;
      const emphasis: Emphasis =
        first.condition === "mould" ? "urgent" : first.condition === "damaged" ? "bold" : "normal";
      blocks.push(bullet(text, emphasis));
    }
  }

  const unchecked = input.shelves.filter((s) => s.condition === null).map((s) => s.number);
  if (unchecked.length > 0) {
    blocks.push({ kind: "label", text: "Not checked:", emphasis: "bold" });
    const name = unchecked.length === 1 ? "Shelf" : "Shelves";
    blocks.push(bullet(sentence(`${name} ${formatRanges(unchecked)}`)));
  }
  return { title: "Shelf Conditions", blocks };
}

type ReportIssue = ReportInput["issues"][number];

const isRecurring = (i: ReportIssue) => i.visitsSeen >= RECURRING_MIN_VISITS;
const stillOpen = (i: ReportIssue) => i.state !== "resolved";

function issueEmphasis(i: ReportIssue): Emphasis {
  if (!stillOpen(i)) return "normal";
  if (i.severity === "immediate") return "urgent";
  return i.severity === "high" ? "bold" : "normal";
}

const STATE_TEXT: Record<IssueUpdateState, string> = {
  new: "New on this visit.",
  still_open: "Still open.",
  improved: "Improved, not yet resolved.",
  resolved: "Resolved on this visit.",
};

const bySeverity = (a: ReportIssue, b: ReportIssue) =>
  SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
  Number(isRecurring(b)) - Number(isRecurring(a)) ||
  a.title.localeCompare(b.title);

// One section per issue category on this visit, most severe category first.
function issueSections(issues: ReportIssue[]): Section[] {
  const byCategory = new Map<IssueCategory, ReportIssue[]>();
  for (const issue of issues) {
    byCategory.set(issue.category, [...(byCategory.get(issue.category) ?? []), issue]);
  }
  return [...byCategory.entries()]
    .map(([category, list]) => ({ category, list: list.sort(bySeverity) }))
    .sort(
      (a, b) =>
        bySeverity(a.list[0], b.list[0]) ||
        CATEGORY_LABELS[a.category].localeCompare(CATEGORY_LABELS[b.category]),
    )
    .map(({ category, list }) => {
      const blocks: Block[] = [];
      for (const issue of list) {
        let text = `${issue.title}: ${STATE_TEXT[issue.state]}`;
        if (issue.state === "new" && issue.description?.trim()) {
          text += ` ${sentence(issue.description)}`;
        }
        if (issue.note?.trim()) text += ` ${sentence(issue.note)}`;
        if (isRecurring(issue)) text += ` (${recurringLabel(issue.visitsSeen)})`;
        blocks.push(bullet(text, issueEmphasis(issue)));
      }
      const photos = list.flatMap((i) => i.photos);
      if (photos.length > 0) blocks.push({ kind: "photos", photos });
      return { title: titleCase(CATEGORY_LABELS[category]), blocks };
    });
}

// "Picker 1 (about 1 month, returning):" then the points as bullets.
function staffSection(input: ReportInput): Section {
  const blocks: Block[] = [];
  for (const { value, label } of STAFF_ROLES) {
    const people = input.staff.filter((s) => s.role === value);
    people.forEach((person, index) => {
      const details = [person.tenureNote?.trim(), person.returning ? "returning" : null].filter(
        Boolean,
      );
      const name = people.length > 1 ? `${label} ${index + 1}` : label;
      blocks.push({
        kind: "label",
        text: `${name}${details.length ? ` (${details.join(", ")})` : ""}:`,
        emphasis: "bold",
      });
      const points = lines(person.points);
      if (points.length === 0) blocks.push(bullet("No comments recorded."));
      for (const point of points) blocks.push(bullet(sentence(point)));
    });
  }
  return { title: "Staff Feedback", blocks };
}

function impressionSection(input: ReportInput): Section {
  const blocks: Block[] = [];
  if (input.managerPresent !== null) {
    blocks.push(
      bullet(input.managerPresent ? "The manager was present." : "The manager was not present."),
    );
  }
  for (const l of lines(input.overallImpression)) blocks.push(bullet(sentence(l)));
  return { title: "Overall Impression", blocks };
}

// Issues seen on this visit and still open, most severe first.
function prioritySection(issues: ReportIssue[]): Section {
  return {
    title: "Priority Actions",
    blocks: issues
      .filter(stillOpen)
      .sort(bySeverity)
      .map((issue) => {
        let text = issue.severity === "immediate" ? `IMMEDIATE: ${issue.title}` : issue.title;
        text = sentence(text);
        if (issue.note?.trim()) text += ` ${sentence(issue.note)}`;
        if (isRecurring(issue)) text += ` (${recurringLabel(issue.visitsSeen)})`;
        return bullet(text, issueEmphasis(issue));
      }),
  };
}

function bullet(text: string, emphasis: Emphasis = "normal"): Block {
  return { kind: "bullet", text, emphasis };
}

// ---- report -------------------------------------------------------------

export function buildReport(input: ReportInput): Report {
  // Issues hidden from outputs never appear, not even in Priority Actions.
  const issues = input.issues.filter((i) => !i.excluded);

  const sections: Section[] = [
    stockSection(input),
    shelfSection(input),
    ...issueSections(issues),
    staffSection(input),
    impressionSection(input),
    prioritySection(issues),
  ].filter((s) => s.blocks.length > 0); // empty sections are left out

  const blocks: Block[] = [];
  sections.forEach((section, i) => {
    blocks.push({ kind: "heading", number: i + 1, text: section.title });
    blocks.push(...section.blocks);
  });

  const subtitle = [
    input.visitLabel,
    formatLongDate(input.visitDate),
    input.preparedBy ? `Prepared by ${input.preparedBy}` : null,
  ]
    .filter(Boolean)
    .join("  |  ");

  // Last step: strip em/en dashes from every piece of text, including
  // what was typed into the app.
  return {
    title: noDashes(`${input.hubName} Hub - Visit Report`),
    subtitle: noDashes(subtitle),
    fileName: `${input.hubName}_Visit_${input.visitNumber}_${input.visitDate}.docx`.replace(
      /[^\w.-]+/g,
      "_",
    ),
    blocks: blocks.map((b) =>
      b.kind === "photos"
        ? { ...b, photos: b.photos.map((p) => ({ ...p, caption: p.caption && noDashes(p.caption) })) }
        : { ...b, text: noDashes(b.text) },
    ),
  };
}
