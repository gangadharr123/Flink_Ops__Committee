// Runs every migration against a real Postgres (PGlite, in memory) and
// checks the row-level security rules by acting as different users.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const MIGRATIONS_DIR = join(__dirname, "..", "supabase", "migrations");
// Supabase's roles, auth.users and auth.uid(), which our migrations rely on.
const SUPABASE_STANDIN = readFileSync(
  join(__dirname, "supabase-standin.sql"),
  "utf8",
);

const VIEWER_ID = "00000000-0000-0000-0000-00000000000a";
const INSPECTOR_ID = "00000000-0000-0000-0000-00000000000b";

// Supabase grants table access to these roles by default and relies on RLS.
const SUPABASE_DEFAULT_GRANTS = `
  grant select, insert, update, delete on all tables in schema public
    to anon, authenticated;
`;

let db: PGlite;

// Run fn as a logged-in user, then roll back so tests don't affect each other.
async function asUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  await db.exec("begin");
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [
      userId,
    ]);
    await db.exec("set local role authenticated");
    return await fn();
  } finally {
    await db.exec("rollback");
  }
}

async function darmstadtId() {
  const { rows } = await db.query<{ id: string }>(
    "select id from public.hubs where name = 'Darmstadt'",
  );
  return rows[0].id;
}

function insertVisit(hubId: string, inspectorId: string) {
  return db.query(
    `insert into public.visits (hub_id, inspector_id, visit_date, visit_number)
     values ($1, $2, '2026-10-20', 99)`,
    [hubId, inspectorId],
  );
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STANDIN);

  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
  for (const file of files.sort()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }
  await db.exec(SUPABASE_DEFAULT_GRANTS);

  // Creating auth users fires the trigger that makes their profiles (as viewer).
  await db.query(
    `insert into auth.users (id, email) values
       ($1, 'viewer@example.com'), ($2, 'inspector@example.com')`,
    [VIEWER_ID, INSPECTOR_ID],
  );
  await db.query("update public.profiles set role = 'inspector' where id = $1", [
    INSPECTOR_ID,
  ]);
}, 60_000);

describe("row-level security", () => {
  it("blocks a viewer from inserting a visit", async () => {
    const hubId = await darmstadtId();
    await expect(
      asUser(VIEWER_ID, () => insertVisit(hubId, VIEWER_ID)),
    ).rejects.toThrow(/row-level security/);
  });

  it("lets an inspector insert a visit", async () => {
    // Control: proves the viewer test fails because of RLS, not a broken setup.
    const hubId = await darmstadtId();
    const result = await asUser(INSPECTOR_ID, () =>
      insertVisit(hubId, INSPECTOR_ID),
    );
    expect(result.affectedRows).toBe(1);
  });

  it("lets a viewer read the seeded hubs and shelves", async () => {
    const counts = await asUser(VIEWER_ID, async () => {
      const hubs = await db.query("select 1 from public.hubs");
      const shelves = await db.query("select 1 from public.shelves");
      return { hubs: hubs.rows.length, shelves: shelves.rows.length };
    });
    expect(counts).toEqual({ hubs: 2, shelves: 140 });
  });

  it("stops a viewer from making themselves admin", async () => {
    const result = await asUser(VIEWER_ID, () =>
      db.query("update public.profiles set role = 'admin' where id = $1", [
        VIEWER_ID,
      ]),
    );
    // RLS hides the row from the update, so nothing changes.
    expect(result.affectedRows).toBe(0);
  });
});
