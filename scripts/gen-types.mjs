// Run with: npm run db:types
// Applies supabase/migrations to an in-memory Postgres (PGlite) and writes
// src/lib/database.types.ts in the same shape as `supabase gen types`.
// Works offline, no Supabase CLI or Docker needed.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const projectDir = join(import.meta.dirname, "..");
const outPath = join(projectDir, "src", "lib", "database.types.ts");

const db = new PGlite();
await db.exec(readFileSync(join(projectDir, "tests", "supabase-standin.sql"), "utf8"));
const dir = join(projectDir, "supabase", "migrations");
for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  await db.exec(readFileSync(join(dir, f), "utf8"));
}

const q = async (sql) => (await db.query(sql)).rows;

const enums = await q(`
  select t.typname as name, array_agg(e.enumlabel order by e.enumsortorder) as labels
  from pg_type t join pg_enum e on e.enumtypid = t.oid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public' group by t.typname order by t.typname`);
const enumNames = new Set(enums.map((e) => e.name));

const cols = await q(`
  select c.table_name, t.table_type, c.column_name, c.data_type, c.udt_name, c.is_nullable,
         c.column_default, c.is_identity, c.ordinal_position
  from information_schema.columns c
  join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
  where c.table_schema = 'public' and t.table_type in ('BASE TABLE', 'VIEW')
  order by c.table_name, c.column_name`);

const fks = await q(`
  select con.conname, rel.relname as table_name, frel.relname as ref_table, fns.nspname as ref_schema,
    (select array_agg(a.attname order by k.ord) from unnest(con.conkey) with ordinality k(attnum, ord)
       join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum) as columns,
    (select array_agg(a.attname order by k.ord) from unnest(con.confkey) with ordinality k(attnum, ord)
       join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.attnum) as ref_columns,
    exists (select 1 from pg_constraint u where u.conrelid = con.conrelid and u.contype in ('p','u')
            and u.conkey::int[] @> con.conkey::int[] and u.conkey::int[] <@ con.conkey::int[]) as one_to_one
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid join pg_namespace ns on ns.oid = rel.relnamespace
  join pg_class frel on frel.oid = con.confrelid join pg_namespace fns on fns.oid = frel.relnamespace
  where con.contype = 'f' and ns.nspname = 'public'
  order by con.conname`);

const fns = await q(`
  select p.proname as name, pg_get_function_result(p.oid) as result,
    coalesce((select json_agg(json_build_object('name', a.name, 'type', format_type(a.type, null)) order by a.ord)
              from unnest(p.proargnames[1:p.pronargs], p.proargtypes::oid[]) with ordinality a(name, type, ord)),
             '[]') as args,
    p.pronargdefaults as ndefaults
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and pg_get_function_result(p.oid) <> 'trigger'
  order by p.proname`);

function tsType(c) {
  const base = (udt) => {
    if (enumNames.has(udt)) return `Database["public"]["Enums"]["${udt}"]`;
    switch (udt) {
      case "uuid": case "text": case "varchar": case "date": case "timestamptz": case "timestamp": return "string";
      case "int2": case "int4": case "int8": case "numeric": case "float4": case "float8": return "number";
      case "bool": return "boolean";
      case "json": case "jsonb": return "Json";
      default: throw new Error("unmapped type " + udt);
    }
  };
  if (c.data_type === "ARRAY") return `${base(c.udt_name.replace(/^_/, ""))}[]`;
  return base(c.udt_name);
}

const fnType = (r) => {
  if (enumNames.has(r)) return `Database["public"]["Enums"]["${r}"]`;
  if (r === "boolean") return "boolean";
  if (r === "integer") return "number";
  if (["uuid", "text", "date"].includes(r)) return "string";
  throw new Error("unmapped fn type " + r);
};

const tables = [...new Set(cols.filter((c) => c.table_type === "BASE TABLE").map((c) => c.table_name))].sort();
const views = [...new Set(cols.filter((c) => c.table_type === "VIEW").map((c) => c.table_name))].sort();
const I = (n) => " ".repeat(n);
let tablesTs = "";
for (const t of tables) {
  const tc = cols.filter((c) => c.table_name === t);
  const row = tc.map((c) => `${I(10)}${c.column_name}: ${tsType(c)}${c.is_nullable === "YES" ? " | null" : ""}`).join("\n");
  const ins = tc.map((c) => {
    const opt = c.is_nullable === "YES" || c.column_default !== null || c.is_identity === "YES";
    return `${I(10)}${c.column_name}${opt ? "?" : ""}: ${tsType(c)}${c.is_nullable === "YES" ? " | null" : ""}`;
  }).join("\n");
  const upd = tc.map((c) => `${I(10)}${c.column_name}?: ${tsType(c)}${c.is_nullable === "YES" ? " | null" : ""}`).join("\n");
  const rels = fks.filter((f) => f.table_name === t && f.ref_schema === "public").map((f) => [
    `${I(10)}{`,
    `${I(12)}foreignKeyName: "${f.conname}"`,
    `${I(12)}columns: [${f.columns.map((x) => `"${x}"`).join(", ")}]`,
    `${I(12)}isOneToOne: ${f.one_to_one}`,
    `${I(12)}referencedRelation: "${f.ref_table}"`,
    `${I(12)}referencedColumns: [${f.ref_columns.map((x) => `"${x}"`).join(", ")}]`,
    `${I(10)}},`,
  ].join("\n")).join("\n");
  tablesTs += `${I(6)}${t}: {
${I(8)}Row: {
${row}
${I(8)}}
${I(8)}Insert: {
${ins}
${I(8)}}
${I(8)}Update: {
${upd}
${I(8)}}
${I(8)}Relationships: [${rels ? "\n" + rels + "\n" + I(8) : ""}]
${I(6)}}
`;
}

// Views: read-only, and Postgres can't tell whether view columns are null.
let viewsTs = "";
for (const v of views) {
  const vc = cols.filter((c) => c.table_name === v);
  const row = vc.map((c) => `${I(10)}${c.column_name}: ${tsType(c)} | null`).join("\n");
  viewsTs += `${I(6)}${v}: {
${I(8)}Row: {
${row}
${I(8)}}
${I(8)}Relationships: []
${I(6)}}
`;
}

const fnTs = fns.map((f) => {
  const args = f.args.length
    ? // the last `ndefaults` arguments have defaults, so they are optional
      `{ ${f.args
        .map((a, i) => `${a.name}${i >= f.args.length - f.ndefaults ? "?" : ""}: ${fnType(a.type)}`)
        .join("; ")} }`
    : "never";
  return `${I(6)}${f.name}: { Args: ${args}; Returns: ${fnType(f.result)} }`;
}).join("\n");

const enumTs = enums.map((e) => `${I(6)}${e.name}:\n${e.labels.map((l) => `${I(8)}| "${l}"`).join("\n")}`).join("\n");
const constTs = enums.map((e) => `${I(6)}${e.name}: [${e.labels.map((l) => `"${l}"`).join(", ")}],`).join("\n");

const out = `// Database types in the format of \`supabase gen types typescript\`.
// Generated from supabase/migrations. Don't edit by hand: after changing the
// schema, regenerate with \`npm run db:types\` (see README).

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
${tablesTs}    }
    Views: {
${viewsTs || "      [_ in never]: never\n"}    }
    Functions: {
${fnTs}
    }
    Enums: {
${enumTs}
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database["public"]

export type Tables<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Update"]
export type Enums<T extends keyof DefaultSchema["Enums"]> =
  DefaultSchema["Enums"][T]

export const Constants = {
  public: {
    Enums: {
${constTs}
    },
  },
} as const
`;
writeFileSync(outPath, out);
console.error(`tables: ${tables.length}, views: ${views.length}, enums: ${enums.length}, functions: ${fns.length}`);
