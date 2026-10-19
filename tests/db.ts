// Shared test database: runs every migration against a real Postgres
// (PGlite, in memory) with a stand-in for the Supabase bits.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS_DIR = join(__dirname, "..", "supabase", "migrations");

export const VIEWER_ID = "00000000-0000-0000-0000-00000000000a";
export const INSPECTOR_ID = "00000000-0000-0000-0000-00000000000b";
export const ADMIN_ID = "00000000-0000-0000-0000-00000000000c";

export async function createTestDb() {
  const db = new PGlite();
  await db.exec(readFileSync(join(__dirname, "supabase-standin.sql"), "utf8"));

  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
  for (const file of files.sort()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }

  // Supabase grants table access to these roles by default and relies on RLS.
  await db.exec(`
    grant select, insert, update, delete on all tables in schema public
      to anon, authenticated;
  `);

  // Creating auth users fires the trigger that makes their profiles (as viewer).
  await db.query(
    `insert into auth.users (id, email) values
       ($1, 'viewer@example.com'),
       ($2, 'inspector@example.com'),
       ($3, 'admin@example.com')`,
    [VIEWER_ID, INSPECTOR_ID, ADMIN_ID],
  );
  await db.query("update public.profiles set role = 'inspector' where id = $1", [
    INSPECTOR_ID,
  ]);
  await db.query("update public.profiles set role = 'admin' where id = $1", [
    ADMIN_ID,
  ]);

  // Run fn as a logged-in user, then roll back so tests don't affect each other.
  async function asUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    await db.exec("begin");
    try {
      await setUser(userId);
      return await fn();
    } finally {
      await db.exec("rollback");
    }
  }

  // Switch user inside an open transaction (for tests with several actors).
  async function setUser(userId: string) {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [
      userId,
    ]);
    await db.exec("set local role authenticated");
  }

  async function hubId(name: string) {
    const { rows } = await db.query<{ id: string }>(
      "select id from public.hubs where name = $1",
      [name],
    );
    return rows[0].id;
  }

  return { db, asUser, setUser, hubId };
}
