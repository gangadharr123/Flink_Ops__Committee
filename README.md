# HubCheck

Web app for Flink Ops Committee hub visits (Darmstadt, Mainz).
Next.js + Supabase, hosted on Netlify. See `CLAUDE.md` for the full brief.

## Local setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the Supabase URL and publishable key.
3. `npm run dev` and open http://localhost:3000

## Supabase setup (one time)

1. **Run the migrations**: paste each file in `supabase/migrations/` (oldest first) into the Supabase SQL editor and run it.
2. **Invite-only login**: Authentication > Sign In / Providers: turn off "Allow new users to sign up".
   Add people under Authentication > Users > Add user (or Invite).
3. **Redirect URLs**: Authentication > URL Configuration:
   - Site URL: your Netlify URL (or `http://localhost:3000` for now)
   - Redirect URLs: `http://localhost:3000/auth/confirm` and `https://<your-site>.netlify.app/auth/confirm`
4. **Magic link email**: Authentication > Emails > Magic Link, set the link to:
   ```html
   <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Log in to HubCheck</a>
   ```
   This lets the link work even when it opens in the mail app's browser.
5. **Make yourself admin**: in the SQL editor:
   ```sql
   update public.profiles set role = 'admin', full_name = 'Your Name'
   where id = (select id from auth.users where email = 'you@example.com');
   ```

New users start as `viewer`. Admins change roles in the `profiles` table.

## Roles

| | read everything | write visits, shelf checks, issues, updates, feedback, photos | edit hubs, shelves, profiles |
|---|---|---|---|
| viewer | yes | no | no |
| inspector | yes | yes | no |
| admin | yes | yes | yes |

Enforced by row-level security in `supabase/migrations/20261019200100_rls_policies.sql`.

## Tests and types

- `npm test` runs all migrations in an in-memory Postgres (PGlite) and checks the security rules.
- `npm run db:types` regenerates `src/lib/database.types.ts` from the migrations. Run it after adding a migration.

## Seed data

- `supabase/seed/shelves.csv` is loaded into the database by the `seed_hubs_shelves` migration.
- `supabase/seed/past_visits.json` holds past visits for a later import step.
