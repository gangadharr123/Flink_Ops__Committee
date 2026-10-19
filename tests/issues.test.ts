// create_issue(), resolve-on-submit, draft delete, recurrence and photo storage.
import { beforeAll, describe, expect, it } from "vitest";
import { recurrenceByIssue } from "../src/lib/issues";
import { createTestDb, INSPECTOR_ID, VIEWER_ID } from "./db";

let t: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  t = await createTestDb();
}, 60_000);

async function createVisit(hub: string, date: string) {
  const { rows } = await t.db.query<{ id: string }>(
    "select public.create_visit($1, $2) as id",
    [await t.hubId(hub), date],
  );
  return rows[0].id;
}

async function createIssue(visitId: string, title: string, severity = "high") {
  const { rows } = await t.db.query<{ id: string }>(
    "select public.create_issue($1, 'floor', $2, $3::public.issue_severity, 'desc') as id",
    [visitId, title, severity],
  );
  return rows[0].id;
}

async function issue(id: string) {
  const { rows } = await t.db.query<{
    issue_key: string;
    status: string;
    resolved_visit_id: string | null;
    first_seen_visit_id: string | null;
  }>("select * from public.issues where id = $1", [id]);
  return rows[0];
}

const submit = (visitId: string) =>
  t.db.query("update public.visits set status = 'submitted' where id = $1", [visitId]);

const addUpdate = (issueId: string, visitId: string, state: string) =>
  t.db.query(
    "insert into public.issue_updates (issue_id, visit_id, state) values ($1, $2, $3::public.issue_update_state)",
    [issueId, visitId, state],
  );

describe("create_issue", () => {
  it("creates the issue with a 'new' update and a readable unique key", async () => {
    await t.asUser(INSPECTOR_ID, async () => {
      const visit = await createVisit("Darmstadt", "2026-10-01");
      const a = await createIssue(visit, "Fridge 13 door handle!");
      const b = await createIssue(visit, "Fridge 13 door handle");
      expect((await issue(a)).issue_key).toBe("D-fridge-13-door-handle");
      expect((await issue(b)).issue_key).toBe("D-fridge-13-door-handle-2");
      expect((await issue(a)).first_seen_visit_id).toBe(visit);

      const { rows } = await t.db.query(
        "select state from public.issue_updates where issue_id = $1",
        [a],
      );
      expect(rows).toEqual([{ state: "new" }]);
    });
  });

  it("refuses a viewer, and a submitted visit", async () => {
    await expect(
      t.asUser(INSPECTOR_ID, async () => {
        const visit = await createVisit("Mainz", "2026-10-01");
        await t.setUser(VIEWER_ID);
        await createIssue(visit, "Viewer issue");
      }),
    ).rejects.toThrow(/not editable/);
    await expect(
      t.asUser(INSPECTOR_ID, async () => {
        const visit = await createVisit("Mainz", "2026-10-01");
        await submit(visit);
        await createIssue(visit, "Too late");
      }),
    ).rejects.toThrow(/not editable/);
  });
});

describe("resolving and deleting", () => {
  it("resolves an issue only when the visit is submitted", async () => {
    await t.asUser(INSPECTOR_ID, async () => {
      const first = await createVisit("Darmstadt", "2026-09-01");
      const id = await createIssue(first, "AC leak");
      await submit(first);

      const second = await createVisit("Darmstadt", "2026-09-15");
      await addUpdate(id, second, "resolved");
      expect((await issue(id)).status).toBe("open");

      await submit(second);
      expect(await issue(id)).toMatchObject({ status: "resolved", resolved_visit_id: second });
    });
  });

  it("deleting a draft deletes the issues first seen in it, not older ones", async () => {
    await t.asUser(INSPECTOR_ID, async () => {
      const first = await createVisit("Mainz", "2026-09-01");
      const old = await createIssue(first, "Old issue");
      await submit(first);

      const draft = await createVisit("Mainz", "2026-09-15");
      const fresh = await createIssue(draft, "Test issue");
      await addUpdate(old, draft, "still_open");
      await t.db.query("delete from public.visits where id = $1", [draft]);

      expect(await issue(fresh)).toBeUndefined();
      expect((await issue(old)).status).toBe("open");
    });
  });

  it("stops an inspector deleting an issue from a submitted visit", async () => {
    await t.asUser(INSPECTOR_ID, async () => {
      const visit = await createVisit("Mainz", "2026-09-01");
      const id = await createIssue(visit, "Keep me");
      await submit(visit);
      const del = await t.db.query("delete from public.issues where id = $1", [id]);
      expect(del.affectedRows).toBe(0);
    });
  });
});

describe("issue_stats (recurring)", () => {
  it("counts visits where the issue was present and agrees with recurrenceByIssue()", async () => {
    await t.asUser(INSPECTOR_ID, async () => {
      // Seen on visits 1-3 (new, still open, improved), resolved on 4.
      const v1 = await createVisit("Darmstadt", "2026-08-01");
      const id = await createIssue(v1, "Mould");
      const other = await createIssue(v1, "Water filter");
      await submit(v1);
      const v2 = await createVisit("Darmstadt", "2026-08-11");
      await addUpdate(id, v2, "still_open");
      await submit(v2);
      const v3 = await createVisit("Darmstadt", "2026-08-21");
      await addUpdate(id, v3, "improved");
      await addUpdate(other, v3, "resolved");
      await submit(v3);
      const v4 = await createVisit("Darmstadt", "2026-08-31");
      await addUpdate(id, v4, "resolved");
      await submit(v4);

      const { rows } = await t.db.query<{
        issue_id: string;
        visits_seen: number;
        is_recurring: boolean;
        days_open: number;
      }>(
        "select issue_id, visits_seen, is_recurring, days_open from public.issue_stats where issue_id in ($1, $2)",
        [id, other],
      );
      const stats = Object.fromEntries(rows.map((r) => [r.issue_id, r]));
      expect(stats[id]).toMatchObject({ visits_seen: 3, is_recurring: true, days_open: 30 });
      expect(stats[other]).toMatchObject({ visits_seen: 1, is_recurring: false, days_open: 20 });

      const updates = await t.db.query<{
        issue_id: string;
        visit_id: string;
        state: "new" | "still_open" | "improved" | "resolved";
      }>(
        "select issue_id, visit_id, state from public.issue_updates where issue_id in ($1, $2)",
        [id, other],
      );
      const ts = recurrenceByIssue(updates.rows);
      expect(ts[id]).toEqual({ visitsSeen: 3, isRecurring: true });
      expect(ts[other]).toEqual({ visitsSeen: 1, isRecurring: false });
    });
  });
});

describe("photo storage", () => {
  const upload = (path: string) =>
    t.db.query("insert into storage.objects (bucket_id, name) values ('visit-photos', $1)", [path]);

  it("lets an inspector upload into a draft visit's folder", async () => {
    await t.asUser(INSPECTOR_ID, async () => {
      const visit = await createVisit("Mainz", "2026-10-10");
      expect((await upload(`${visit}/photo.jpg`)).affectedRows).toBe(1);
    });
  });

  it("blocks uploads to submitted visits, bad paths and viewers", async () => {
    await t.asUser(INSPECTOR_ID, async () => {
      const visit = await createVisit("Mainz", "2026-10-10");
      await submit(visit);
      await expect(upload(`${visit}/photo.jpg`)).rejects.toThrow(/row-level security/);
    });
    await t.asUser(INSPECTOR_ID, async () => {
      await expect(upload("not-a-visit/photo.jpg")).rejects.toThrow(/row-level security/);
    });
    await t.asUser(INSPECTOR_ID, async () => {
      const visit = await createVisit("Mainz", "2026-10-10");
      await t.setUser(VIEWER_ID);
      await expect(upload(`${visit}/photo.jpg`)).rejects.toThrow(/row-level security/);
    });
  });
});
