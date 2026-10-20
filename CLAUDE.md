# HubCheck

Web app for my Flink Ops Committee hub visits (Darmstadt, Mainz).
I log visits on my phone; my manager views the dashboard and reports on a laptop.
Zero budget: open-source libraries and free tiers only. Never add a paid service.

## Stack
- Next.js (App Router) + TypeScript, Tailwind CSS, shadcn/ui
- Supabase: Postgres, Auth (email magic links), Storage (photos)
- React Hook Form + Zod for forms, Recharts for charts, docx (npm) for Word export
- Hosted on Netlify, code on GitHub

## Commands
- npm run dev     (local server at localhost:3000)
- npm run build   (must pass before any commit)
- npm run lint
- npm test          (migrations + RLS tests in PGlite)
- npm run db:types  (regenerate src/lib/database.types.ts after a migration)

## Structure
- src/app/        pages and server routes
- src/components/ reusable UI
- src/lib/        Supabase clients, report and Airtable text builders
- supabase/migrations/  every database change as a new SQL file, never edit old ones
- docs/sample-report.docx  the report layout to match

## Data model
hubs, shelves, visits, shelf_checks, issues, issue_updates, staff_feedback, photos, profiles.
An issue lives across visits; each visit adds an issue_update (new / still open / improved / resolved).
"Recurring" = seen on 3 or more visits.

## Rules
- Mobile-first visit form; dashboard and reports must also work well on a laptop.
  Test layouts at 375px and 1280px wide.
- Roles: inspector, viewer, admin. Enforce with Supabase row-level security, not only in the UI.
- Never store staff names. Feedback is by role and tenure only.
- The Supabase service role key is server-only. Never put keys in code, only in .env.local.
- Never read, print or edit .env.local.

## Report and Airtable text style
- Calibri, dash bullets, numbered underlined headings
- No em dashes anywhere
- Immediate items in red and bold; recurring issues say "recurring, seen on N visits"
- Skip issues marked exclude_from_outputs

## How to work with me
- Plan first and wait for my go before big changes.
- Small steps. After each change: run the build, fix errors, then tell me what to test.
- Explain new concepts briefly; I want to understand the code I ship.
- Commit after each working step with a clear message.

## Progress
- Current phase: 4 done (issues: visit step, photos, list, detail, recurring via issue_stats view); Word report done
- Report: src/lib/report/model.ts (pure, reuse for Airtable text), render-docx.ts, load.ts; route /visits/[id]/report
- Airtable answers: src/lib/airtable/answers.ts (pure), page /visits/[id]/airtable, edits in airtable_answers table
- Done: Next.js 16 skeleton, magic-link login (invite-only), profiles migration with RLS, app shell (sidebar / bottom nav); core tables, RLS, hubs + shelves seed, generated types, RLS tests; visit flow (list, new visit, 4-step editor with autosave, shelves, staff feedback, summary, submit, delete draft)
- Visit editor: src/components/visit-editor/, pure logic in src/lib/visit-form.ts, saves via src/app/(app)/visits/actions.ts
- Note: Next.js 16 uses src/proxy.ts (not middleware.ts) and Cache Components: session reads must sit inside <Suspense>