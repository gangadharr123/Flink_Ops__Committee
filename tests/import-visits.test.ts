// The past-visits importer: checks, and the generated SQL run against a
// real Postgres (PGlite) with all migrations, like the Supabase SQL editor.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { Constants } from "../src/lib/database.types";
import {
  CATEGORIES,
  CONDITIONS,
  expandShelves,
  HUBS,
  SEVERITIES,
  STAFF_ROLES,
  summary,
  toSql,
  UPDATE_STATES,
  validate,
} from "../scripts/import-visits/lib.mjs";
import { createTestDb } from "./db";

const SEED = JSON.parse(
  readFileSync(join(__dirname, "..", "supabase", "seed", "past_visits.json"), "utf8"),
);

describe("allowed values", () => {
  it("match the database enums", () => {
    const e = Constants.public.Enums;
    expect(CONDITIONS).toEqual([...e.shelf_condition]);
    expect(SEVERITIES).toEqual([...e.issue_severity]);
    expect(UPDATE_STATES).toEqual([...e.issue_update_state]);
    expect(STAFF_ROLES).toEqual([...e.staff_role]);
    expect(CATEGORIES).toEqual([...e.issue_category]);
    expect(HUBS).toEqual(["Darmstadt", "Mainz"]);
  });
});

describe("expandShelves", () => {
  it("expands numbers and ranges, rejects junk", () => {
    expect(expandShelves("12")).toEqual([12]);
    expect(expandShelves("1-4")).toEqual([1, 2, 3, 4]);
    expect(expandShelves("8-1")).toBeNull();
    expect(expandShelves("1-x")).toBeNull();
    expect(expandShelves("0")).toBeNull();
  });
});

describe("validate", () => {
  it("accepts the real seed file", () => {
    const { errors, data } = validate(SEED);
    expect(errors).toEqual([]);
    expect(summary(data)).toEqual({
      visits: 7,
      shelf_checks: 489,
      staff_feedback: 19,
      issues: 37,
      issue_updates: 59,
    });
  });

  it("requires visit numbers to follow date order per hub", () => {
    const swapped = structuredClone(SEED);
    // Mainz visit 2 dated after visit 3, without renumbering.
    swapped.visits.find((v: { visit_key: string }) => v.visit_key === "M2").visit_date = "2026-10-01";
    expect(validate(swapped).errors).toContain(
      "visits (Mainz): visit_number order doesn't match date order: M2 is number 2 on 2026-10-01, but M3 is number 3 on 2026-09-25",
    );
  });

  it("lists every problem with its location", () => {
    const bad = {
      format_version: 1,
      visits: [
        { visit_key: "A", hub: "Berlin", visit_number: 1, visit_date: "2026-13-01" },
        {
          visit_key: "B",
          hub: "Mainz",
          visit_number: 2,
          visit_date: "2026-10-01",
          shelf_checks: [
            { shelves: "1-3", condition: "dirty" },
            { shelves: "3", condition: "clean", score_5: 7 },
          ],
          staff_feedback: [{ staff_role: "picker", name: "Anna" }],
        },
        { visit_key: "B", hub: "Mainz", visit_number: 2, visit_date: "2026-10-02" },
      ],
      issues: [
        {
          issue_key: "M-x",
          hub: "Darmstadt",
          category: "floor",
          severity: "urgent",
          title: "X",
          updates: [
            { visit_key: "B", state: "still_open" },
            { visit_key: "Z", state: "new" },
          ],
        },
      ],
    };
    const { errors, data } = validate(bad);
    expect(data).toBeNull();
    const text = errors.join("\n");
    for (const expected of [
      "visits[0] (A): hub must be one of Darmstadt, Mainz",
      "visits[0] (A): visit_date must be a date",
      'visits[1] (B).shelf_checks[0]: condition must be one of',
      "visits[1] (B).shelf_checks[1]: score_5 must be a number from 0 to 5",
      "visits[1] (B).shelf_checks[1]: shelf 3 is checked twice in this visit",
      "file.visits[1].staff_feedback[0].name: names must not be stored",
      'visits[2] (B): visit_key "B" is used twice',
      "visits[2] (B): Mainz visit_number 2 is used twice",
      "issues[0] (M-x): severity must be one of",
      "issues[0] (M-x).updates[0]: visit B is at Mainz, but the issue is at Darmstadt",
      'issues[0] (M-x).updates[1]: visit_key "Z" not found in visits',
      'issues[0] (M-x): the first update (visit B) must be "new"',
    ]) {
      expect(text).toContain(expected);
    }
  });
});

describe("generated SQL", () => {
  let t: Awaited<ReturnType<typeof createTestDb>>;
  let sql: string;

  beforeAll(async () => {
    t = await createTestDb();
    await t.db.query("insert into auth.users (id, email) values ($1, 'me@example.com')", [
      "00000000-0000-0000-0000-0000000000dd",
    ]);
    sql = toSql(validate(SEED).data, "Me@Example.com");
  }, 60_000);

  // The last result of the script: rows added per table.
  async function run() {
    const results = await t.db.exec(sql);
    const rows = results.at(-1)!.rows as { table: string; added: number }[];
    return Object.fromEntries(rows.map((r) => [r.table, Number(r.added)]));
  }

  it("imports everything once and links issues across visits", async () => {
    expect(await run()).toEqual({
      visits: 7,
      shelf_checks: 489,
      staff_feedback: 19,
      issues: 37,
      issue_updates: 59,
    });

    const { rows: mould } = await t.db.query<{
      status: string;
      first_label: string;
      visits_seen: number;
    }>(`
      select i.status, v.label as first_label, s.visits_seen
      from public.issues i
      join public.visits v on v.id = i.first_seen_visit_id
      join public.issue_stats s on s.issue_id = i.id
      where i.issue_key = 'D-mould'`);
    expect(mould).toEqual([{ status: "open", first_label: "Visit 1", visits_seen: 3 }]);

    // Darmstadt AC leak: resolved on Visit 3 and hidden from outputs (seed README).
    const { rows: ac } = await t.db.query<{ status: string; resolved: string; excluded: boolean }>(`
      select i.status, v.label as resolved, i.exclude_from_outputs as excluded
      from public.issues i join public.visits v on v.id = i.resolved_visit_id
      where i.issue_key = 'D-ac-leak'`);
    expect(ac).toEqual([{ status: "resolved", resolved: "Visit 3", excluded: true }]);

    const { rows: visits } = await t.db.query<{ status: string; n: number }>(
      "select status, count(*)::int as n from public.visits group by status",
    );
    expect(visits).toEqual([{ status: "submitted", n: 7 }]);
  });

  it("adds nothing when run a second time", async () => {
    expect(await run()).toEqual({
      visits: 0,
      shelf_checks: 0,
      staff_feedback: 0,
      issues: 0,
      issue_updates: 0,
    });
  });

  it("stops if a visit number is taken by a visit with another date (e.g. a test visit)", async () => {
    const clashing = structuredClone(SEED);
    clashing.visits[0].visit_date = "2026-01-01";
    clashing.issues = []; // keep the file valid on its own
    const clashSql = toSql(validate(clashing).data, "me@example.com");
    await expect(t.db.exec(clashSql)).rejects.toThrow(
      /Darmstadt visit 1 \(database: 2026-09-18, file: 2026-01-01\)/,
    );
  });

  it("stops with a clear message if the email has no user", async () => {
    const other = toSql(validate(SEED).data, "nobody@example.com");
    await expect(t.db.exec(other)).rejects.toThrow(/No HubCheck user with email nobody@example.com/);
  });
});
