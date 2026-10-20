// Run with:
//   npm run import:visits -- <past_visits.json> <your-login-email> [output.sql]
//   npm run import:visits -- --check <past_visits.json>   (check only, writes nothing)
// Checks the JSON and writes a SQL file to run in the Supabase SQL editor.
// Never connects to Supabase and needs no keys.
import { readFileSync, writeFileSync } from "node:fs";
import { summary, toSql, validate } from "./lib.mjs";

const args = process.argv.slice(2);
const checkOnly = args[0] === "--check";
const [input, email, output = input?.replace(/\.json$/i, "") + ".import.sql"] = checkOnly
  ? args.slice(1)
  : args;
const USAGE =
  "Usage: npm run import:visits -- <past_visits.json> <your-login-email> [output.sql]\n" +
  "   or: npm run import:visits -- --check <past_visits.json>";

if (!input || (!checkOnly && !email)) {
  console.error(USAGE);
  process.exit(1);
}
if (!checkOnly && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error(`"${email}" doesn't look like an email address.`);
  process.exit(1);
}

let json;
try {
  json = JSON.parse(readFileSync(input, "utf8").replace(/^﻿/, ""));
} catch (e) {
  console.error(`Could not read ${input} as JSON: ${e.message}`);
  process.exit(1);
}

const { errors, data } = validate(json);
if (errors.length) {
  console.error(`${errors.length} problem(s) found, nothing written:\n`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log("File checked: no problems. It contains:");
console.table(summary(data));
if (checkOnly) process.exit(0);

writeFileSync(output, toSql(data, email));
console.log(`\nWrote ${output}`);
console.log("Next: open it, paste everything into the Supabase SQL editor and click Run.");
console.log("The result table shows rows added per table (0 for anything already imported).");
