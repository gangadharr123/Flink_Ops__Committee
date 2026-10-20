// Deleting visits: who may, and what happens to issues shared with other visits.
import { beforeAll, describe, expect, it } from "vitest";
import { ADMIN_ID, createTestDb, INSPECTOR_ID, VIEWER_ID } from "./db";

let t: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  t = await createTestDb();
}, 60_000);

const q = (sql: string, params: unknown[] = []) => t.db.query(sql, params);

async function createVisit(date: string) {
  const hub = await t.hubId("Darmstadt");
  const { rows } = await t.db.query<{ id: string }>("select public.create_visit($1, $2) as id", [hub, date]);
  return rows[0].id;
}
async function createIssue(visitId: string, title: string) {
  const { rows } = await t.db.query<{ id: string }>(
    "select public.create_issue($1, 'floor', $2, 'high', null) as id",
    [visitId, title],
  );
  return rows[0].id;
}
const submit = (id: string) => q("update public.visits set status = 'submitted' where id = $1", [id]);
const addUpdate = (issue: string, visit: string, state: string) =>
  q("insert into public.issue_updates (issue_id, visit_id, state) values ($1, $2, $3::public.issue_update_state)", [issue, visit, state]);

// Three submitted Darmstadt visits:
//   only   - issue recorded only on v1
//   shared - new on v1, still open on v2, resolved on v3
// v1 also has a shelf check, staff feedback, a photo and Airtable answers.
async function scenario() {
  const v1 = await createVisit("2026-09-01");
  const only = await createIssue(v1, "Only on visit 1");
  const shared = await createIssue(v1, "Shared across visits");
  const { rows: shelf } = await t.db.query<{ id: string }>(
    "select s.id from public.shelves s join public.hubs h on h.id = s.hub_id where h.name = 'Darmstadt' and s.number = 1",
  );
  await q("insert into public.shelf_checks (visit_id, shelf_id, condition) values ($1, $2, 'clean')", [v1, shelf[0].id]);
  await q("insert into public.staff_feedback (visit_id, staff_role) values ($1, 'picker')", [v1]);
  await q("insert into storage.objects (bucket_id, name) values ('visit-photos', $1)", [`${v1}/a.jpg`]);
  await q("insert into public.photos (visit_id, issue_id, storage_path) values ($1, $2, $3)", [v1, shared, `${v1}/a.jpg`]);
  await submit(v1);
  await q("insert into public.airtable_answers (visit_id, answers) values ($1, '{}')", [v1]);

  const v2 = await createVisit("2026-09-15");
  await addUpdate(shared, v2, "still_open");
  await submit(v2);

  const v3 = await createVisit("2026-09-29");
  await addUpdate(shared, v3, "resolved");
  await submit(v3);
  return { v1, v2, v3, only, shared };
}

async function issue(id: string) {
  const { rows } = await t.db.query<{ status: string; first_seen_visit_id: string; resolved_visit_id: string | null }>(
    "select status, first_seen_visit_id, resolved_visit_id from public.issues where id = $1",
    [id],
  );
  return rows[0];
}

async function count(table: string, visitId: string) {
  const { rows } = await t.db.query<{ n: number }>(`select count(*)::int as n from public.${table} where visit_id = $1`, [visitId]);
  return rows[0].n;
}

describe("who can delete a visit (row-level security)", () => {
  it("inspectors cannot delete a submitted visit; admins can", async () => {
    await t.asUser(INSPECTOR_ID, async () => {
      const { v1 } = await scenario();
      const byInspector = await q("delete from public.visits where id = $1", [v1]);
      expect(byInspector.affectedRows).toBe(0);
      await t.setUser(ADMIN_ID);
      const byAdmin = await q("delete from public.visits where id = $1", [v1]);
      expect(byAdmin.affectedRows).toBe(1);
    });
  });

  it("viewers cannot delete any visit, not even a draft", async () => {
    await t.asUser(INSPECTOR_ID, async () => {
      const draft = await createVisit("2026-10-01");
      await t.setUser(VIEWER_ID);
      expect((await q("delete from public.visits where id = $1", [draft])).affectedRows).toBe(0);
    });
  });

  it("admins may delete the photo files of a submitted visit; inspectors may not", async () => {
    await t.asUser(INSPECTOR_ID, async () => {
      const { v1 } = await scenario();
      const del = (path: string) => q("delete from storage.objects where name = $1", [path]);
      expect((await del(`${v1}/a.jpg`)).affectedRows).toBe(0);
      await t.setUser(ADMIN_ID);
      expect((await del(`${v1}/a.jpg`)).affectedRows).toBe(1);
    });
  });
});

describe("what deleting a visit removes", () => {
  it("removes its rows and issues recorded only there; shared issues stay with rebuilt history", async () => {
    await t.asUser(INSPECTOR_ID, async () => {
      const { v1, v2, v3, only, shared } = await scenario();
      await t.setUser(ADMIN_ID);
      await q("delete from public.visits where id = $1", [v1]);

      for (const table of ["shelf_checks", "staff_feedback", "photos", "issue_updates", "airtable_answers"]) {
        expect(await count(table, v1), table).toBe(0);
      }
      expect(await issue(only)).toBeUndefined();
      // Shared issue: now first seen on v2 (whose update became "new"), still resolved on v3.
      expect(await issue(shared)).toEqual({
        status: "resolved",
        first_seen_visit_id: v2,
        resolved_visit_id: v3,
      });
      const { rows } = await t.db.query<{ state: string }>(
        "select state from public.issue_updates where issue_id = $1 and visit_id = $2",
        [shared, v2],
      );
      expect(rows).toEqual([{ state: "new" }]);
    });
  });

  it("re-opens a shared issue when the visit that resolved it is deleted", async () => {
    await t.asUser(INSPECTOR_ID, async () => {
      const { v1, v3, shared } = await scenario();
      await t.setUser(ADMIN_ID);
      await q("delete from public.visits where id = $1", [v3]);
      expect(await issue(shared)).toEqual({
        status: "open",
        first_seen_visit_id: v1,
        resolved_visit_id: null,
      });
    });
  });
});
