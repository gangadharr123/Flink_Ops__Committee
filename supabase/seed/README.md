# HubCheck seed data

Two files to put in `supabase/seed/` in the project:

- **shelves.csv**: the shelf map for Darmstadt and Mainz (70 shelves each), with zone and how sure we are about it.
- **past_visits.json**: 7 past visits (Darmstadt 3, Mainz 4), their shelf checks, staff feedback and 37 issues linked across visits.

Built from your visit reports, the Darmstadt 15 Oct spreadsheet and your 7 Oct Mainz handwritten notes. No staff names, nothing you reported privately.

## Check these before importing

**Dates and order** (status as of 20 Oct 2026):

Confirmed (`"date_is_placeholder": false`):
- D2, Darmstadt Visit 2: 2026-10-01
- D3, Darmstadt Visit 3: 2026-10-15
- M3, Mainz Visit 3: 2026-09-25
- M4, Mainz Visit 4: 2026-10-07 (from the handwritten notes)

Still placeholders (`"date_is_placeholder": true`, real dates unknown):
- D1, Darmstadt Visit 1: placeholder 2026-09-18. Known: before 25 Sep, because the Mainz 25 Sep report mentions "the Darmstadt visit".
- M1, Mainz trial shift: placeholder 2026-09-04. Known: the first Mainz visit (4 ops associates and 3 riders interviewed).
- M2, Mainz "Visit 2" report (1 ops associate, 2 riders; Pfand bottles, rain pants, inbound food safety): placeholder 2026-09-11. **Not known whether it was before or after 25 Sep.** The file assumes before (M2 is number 2, M3 is number 3).

If M2 turns out to be after 25 Sep, before importing:
- renumber M3 to 2 and M2 to 3, and swap their labels ("Visit 2" / "Visit 3")
- set M2's date (or a placeholder between 25 Sep and 7 Oct, e.g. 2026-10-01)
- in M-helmet-hygiene, M-bike-maintenance and M-restocking, the M3 update becomes "new" and the M2 update "still_open" (none of these updates has a note)
- run `npm run import:visits -- --check supabase/seed/past_visits.json`; it reports visit numbers that don't follow date order

Fix dates and numbers before importing if you can: imported visits are submitted (read-only in the app), so later corrections need an admin and SQL.

**Darmstadt shelf zones (`zone_confidence` = `check` in shelves.csv):**
- Shelf 9, 14, 15: your Visit 2 notes called 9-15 freezers, but Visit 1 called 14 and 15 fridges and Visit 3 marks 10-13 as fridges.
- Shelf 19: fridge or normal shelf?
- Everything marked `assumed` is ambient because no visit described it otherwise.

**Mainz zones:** taken from your 7 Oct notes (fridges: 9-19, 30-32, 40-45, 53, 55, 57, 59, 61, 62). The freezer section has no shelf numbers.

**Things to know:**
- Mainz trial shift feedback was written per group (4 ops associates, 3 riders), so it is stored as 2 rows. Split into 7 rows if you want exact counts.
- Darmstadt AC leak is marked resolved on Visit 3 and `exclude_from_outputs: true`, matching what you told me for the Airtable form.
- Visit 2 and the Darmstadt floor: the Visit 2 report called floor repairs "recurring from Visit 1", but the Visit 1 report does not mention it. Stored as new on Visit 2 with a note.

## Small schema additions this data needs

Tell Claude Code to add these in Phase 2:

1. `shelf_checks.score_5` (numeric, nullable): your Mainz and Darmstadt Visit 3 scores out of 5.
2. `shelves.zone_confidence` (text): confirmed / assumed / check.
3. `visits.label` (text) and `visits.date_is_placeholder` (boolean).
4. `issues.issue_key` (text, unique): stable id used to link updates, e.g. `D-mould`.
5. Issue categories beyond the guide's list: `riders_room`, `process`, `app_routing`.

## Phase 10 prompt

```text
Read CLAUDE.md. Import supabase/seed/shelves.csv into shelves and supabase/seed/past_visits.json into
visits, shelf_checks, staff_feedback, issues and issue_updates. In shelf_checks, "shelves" is a single
number or a range like "1-8": expand it to one row per shelf. Link issue_updates to visits by visit_key
and to issues by issue_key. Set each issue's first_seen and resolved visit from its updates. Make the
script safe to run twice (skip existing rows). Show me counts per table at the end.
```
