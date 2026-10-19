// create_visit() numbering and pre-fill, and read-only submitted visits.
import { beforeAll, describe, expect, it } from "vitest";
import { ADMIN_ID, createTestDb, INSPECTOR_ID, VIEWER_ID } from "./db";

let t: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  t = await createTestDb();
}, 60_000);

async function createVisit(hubId: string, date = "2026-10-20") {
  const { rows } = await t.db.query<{ id: string }>(
    "select public.create_visit($1, $2) as id",
    [hubId, date],
  );
  return rows[0].id;
}

async function visit(id: string) {
  const { rows } = await t.db.query<{
    visit_number: number;
    label: string;
    status: string;
    previous_visit_id: string | null;
    submitted_at: string | null;
  }>("select * from public.visits where id = $1", [id]);
  return rows[0];
}

async function shelfId(hubId: string, number: number) {
  const { rows } = await t.db.query<{ id: string }>(
    "select id from public.shelves where hub_id = $1 and number = $2",
    [hubId, number],
  );
  return rows[0].id;
}

describe("create_visit", () => {
  it("numbers visits per hub: 1, 2, then 1 for the other hub", async () => {
    await t.asUser(INSPECTOR_ID, async () => {
      const darmstadt = await t.hubId("Darmstadt");
      const mainz = await t.hubId("Mainz");
      const a = await visit(await createVisit(darmstadt));
      const b = await visit(await createVisit(darmstadt));
      const c = await visit(await createVisit(mainz));
      expect([a.visit_number, b.visit_number, c.visit_number]).toEqual([1, 2, 1]);
      expect(b.label).toBe("Visit 2");
      expect(b.status).toBe("draft");
    });
  });

  it("pre-fills condition and score, not comments, from the last submitted visit", async () => {
    await t.asUser(INSPECTOR_ID, async () => {
      const hub = await t.hubId("Darmstadt");
      const shelf = await shelfId(hub, 33);

      const first = await createVisit(hub);
      await t.db.query(
        `insert into public.shelf_checks (visit_id, shelf_id, condition, score_5, comment)
         values ($1, $2, 'mould', 2.5, 'Mould on trays')`,
        [first, shelf],
      );
      await t.db.query(
        "update public.visits set status = 'submitted' where id = $1",
        [first],
      );
      // A draft in between (itself pre-filled) must not be used as the source.
      const draft = await createVisit(hub);
      await t.db.query(
        `update public.shelf_checks set condition = 'clean', score_5 = 5
         where visit_id = $1`,
        [draft],
      );

      const second = await createVisit(hub);
      const { rows } = await t.db.query(
        "select condition, score_5, comment from public.shelf_checks where visit_id = $1",
        [second],
      );
      expect(rows).toEqual([{ condition: "mould", score_5: "2.50", comment: null }]);
      expect((await visit(second)).previous_visit_id).toBe(first);
    });
  });

  it("refuses a viewer", async () => {
    const hub = await t.hubId("Darmstadt");
    await expect(
      t.asUser(VIEWER_ID, () => createVisit(hub)),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("submitted visits are read-only for inspectors", () => {
  // Creates a visit with one shelf check, then submits it.
  async function submittedVisit() {
    const hub = await t.hubId("Mainz");
    const id = await createVisit(hub);
    await t.db.query(
      `insert into public.shelf_checks (visit_id, shelf_id, condition)
       values ($1, $2, 'clean')`,
      [id, await shelfId(hub, 1)],
    );
    await t.db.query("update public.visits set status = 'submitted' where id = $1", [id]);
    return { id, hub };
  }

  it("stamps submitted_at", async () => {
    await t.asUser(INSPECTOR_ID, async () => {
      const { id } = await submittedVisit();
      expect((await visit(id)).submitted_at).not.toBeNull();
    });
  });

  it("blocks editing, reopening and deleting the visit", async () => {
    await t.asUser(INSPECTOR_ID, async () => {
      const { id } = await submittedVisit();
      const edit = await t.db.query(
        "update public.visits set notes = 'changed' where id = $1",
        [id],
      );
      const reopen = await t.db.query(
        "update public.visits set status = 'draft' where id = $1",
        [id],
      );
      const del = await t.db.query("delete from public.visits where id = $1", [id]);
      expect([edit.affectedRows, reopen.affectedRows, del.affectedRows]).toEqual([0, 0, 0]);
    });
  });

  it("blocks changing its shelf checks and adding feedback", async () => {
    await t.asUser(INSPECTOR_ID, async () => {
      const { id, hub } = await submittedVisit();
      const update = await t.db.query(
        "update public.shelf_checks set condition = 'mould' where visit_id = $1",
        [id],
      );
      expect(update.affectedRows).toBe(0);
      await expect(
        t.db.query(
          `insert into public.shelf_checks (visit_id, shelf_id, condition)
           values ($1, $2, 'dusty')`,
          [id, await shelfId(hub, 2)],
        ),
      ).rejects.toThrow(/row-level security/);
    });
    await t.asUser(INSPECTOR_ID, async () => {
      const { id } = await submittedVisit();
      await expect(
        t.db.query(
          "insert into public.staff_feedback (visit_id, staff_role) values ($1, 'picker')",
          [id],
        ),
      ).rejects.toThrow(/row-level security/);
    });
  });

  it("still lets an admin fix a submitted visit", async () => {
    await t.asUser(INSPECTOR_ID, async () => {
      const { id } = await submittedVisit();
      await t.setUser(ADMIN_ID);
      const edit = await t.db.query(
        "update public.visits set notes = 'fixed' where id = $1",
        [id],
      );
      expect(edit.affectedRows).toBe(1);
    });
  });

  it("lets an inspector delete a draft, removing its checks", async () => {
    await t.asUser(INSPECTOR_ID, async () => {
      const hub = await t.hubId("Mainz");
      const id = await createVisit(hub);
      await t.db.query(
        `insert into public.shelf_checks (visit_id, shelf_id, condition)
         values ($1, $2, 'clean')`,
        [id, await shelfId(hub, 3)],
      );
      const del = await t.db.query("delete from public.visits where id = $1", [id]);
      const left = await t.db.query(
        "select 1 from public.shelf_checks where visit_id = $1",
        [id],
      );
      expect([del.affectedRows, left.rows.length]).toEqual([1, 0]);
    });
  });
});
