// Checks the row-level security rules by acting as different users.
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, INSPECTOR_ID, VIEWER_ID } from "./db";

let t: Awaited<ReturnType<typeof createTestDb>>;

function insertVisit(hubId: string, inspectorId: string) {
  return t.db.query(
    `insert into public.visits (hub_id, inspector_id, visit_date, visit_number)
     values ($1, $2, '2026-10-20', 99)`,
    [hubId, inspectorId],
  );
}

beforeAll(async () => {
  t = await createTestDb();
}, 60_000);

describe("row-level security", () => {
  it("blocks a viewer from inserting a visit", async () => {
    const hubId = await t.hubId("Darmstadt");
    await expect(
      t.asUser(VIEWER_ID, () => insertVisit(hubId, VIEWER_ID)),
    ).rejects.toThrow(/row-level security/);
  });

  it("lets an inspector insert a visit", async () => {
    // Control: proves the viewer test fails because of RLS, not a broken setup.
    const hubId = await t.hubId("Darmstadt");
    const result = await t.asUser(INSPECTOR_ID, () =>
      insertVisit(hubId, INSPECTOR_ID),
    );
    expect(result.affectedRows).toBe(1);
  });

  it("lets a viewer read the seeded hubs and shelves", async () => {
    const counts = await t.asUser(VIEWER_ID, async () => {
      const hubs = await t.db.query("select 1 from public.hubs");
      const shelves = await t.db.query("select 1 from public.shelves");
      return { hubs: hubs.rows.length, shelves: shelves.rows.length };
    });
    expect(counts).toEqual({ hubs: 2, shelves: 140 });
  });

  it("stops a viewer from making themselves admin", async () => {
    const result = await t.asUser(VIEWER_ID, () =>
      t.db.query("update public.profiles set role = 'admin' where id = $1", [
        VIEWER_ID,
      ]),
    );
    // RLS hides the row from the update, so nothing changes.
    expect(result.affectedRows).toBe(0);
  });
});
