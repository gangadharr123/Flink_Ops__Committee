# HubCheck

Web app for Flink Ops Committee hub visits (Darmstadt, Mainz).
Next.js + Supabase, hosted on Netlify. See `CLAUDE.md` for the full brief.
Zero budget: free tiers only.

## Local setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the Supabase URL and publishable key.
3. `npm run dev` and open http://localhost:3000

## Environment variables

| Name | Where to find it | Where to set it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase > Project Settings > Data API > Project URL | `.env.local` and Netlify |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase > Project Settings > API Keys > Publishable key | `.env.local` and Netlify |

Both are public by design (they reach the browser); row-level security protects the data.
The app never uses the Supabase **secret / service role key**. Don't add it anywhere.

GitHub needs the same two values as repository secrets for the keep-alive job (see below),
named `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.

## Supabase setup (one time)

1. **Run the migrations**: paste each file in `supabase/migrations/` into the Supabase SQL editor
   and run it, oldest first:
   1. `20261019000000_profiles.sql`
   2. `20261019200000_core_tables.sql`
   3. `20261019200100_rls_policies.sql`
   4. `20261019200200_seed_hubs_shelves.sql`
   5. `20261020000000_visit_flow.sql`
   6. `20261021000000_issues.sql` (also creates the private `visit-photos` storage bucket)
   7. `20261022000000_stock_and_space.sql`
   8. `20261023000000_airtable_answers.sql`
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

## Deploy to Netlify (free plan)

1. Push the code to GitHub (`main` branch).
2. In Netlify: **Add new site > Import an existing project > GitHub**, pick this repository.
   Netlify reads `netlify.toml` (build command `npm run build`, Node 24) and detects Next.js;
   leave the build settings as they are.
3. Before the first deploy, open **Site configuration > Environment variables** and add
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (values from `.env.local`).
   Scope: all deploy contexts.
4. Deploy. Note the site address, e.g. `https://hubcheck-xyz.netlify.app`
   (Site configuration > Change site name to pick a nicer one).
5. In Supabase > Authentication > URL Configuration:
   - set **Site URL** to the Netlify address
   - add `https://<your-site>.netlify.app/auth/confirm` to **Redirect URLs** (keep the localhost one for development)
6. Test on the live site: log in with a magic link, open a visit, download a report.
7. Every push to `main` now redeploys automatically.

**If the first deploy fails** with an error about prerendering, Partial Prefetching or Cache
Components: in `next.config.ts` set `partialPrefetching: false`, commit and push. These Next.js 16
features are new and depend on Netlify's Next.js adapter.

**Emails to other people**: Supabase's built-in email sender is meant for testing. It has a low
hourly limit and may only deliver to members of your Supabase team. If your manager doesn't
receive the login link, set up a free SMTP provider under Authentication > Emails > SMTP Settings
(check the provider's current free limits).

## Keep Supabase awake

Free Supabase projects pause after 7 days without activity. The GitHub Actions workflow
`.github/workflows/supabase-keepalive.yml` makes one small database read every 3 days.

1. GitHub repository > **Settings > Secrets and variables > Actions > New repository secret**:
   - `SUPABASE_URL`: the Project URL
   - `SUPABASE_PUBLISHABLE_KEY`: the publishable key (never the secret key)
2. **Actions** tab > **Keep Supabase awake** > **Run workflow** once, and check it ends green
   ("Supabase answered HTTP 200").
3. If a run fails, GitHub emails you. A failure usually means the project is already paused:
   restore it in the Supabase dashboard.

GitHub turns off scheduled workflows in a **public** repository after 60 days with no commits.
If you stop working on the code for two months, check the Actions tab and re-enable it.

## Roles

| | read everything | write visits, shelf checks, issues, updates, feedback, photos | edit hubs, shelves, profiles |
|---|---|---|---|
| viewer | yes | no | no |
| inspector | yes | yes | no |
| admin | yes | yes | yes |

Enforced by row-level security in `supabase/migrations/`.

## Tests and types

- `npm test` runs all migrations in an in-memory Postgres (PGlite) and checks the security rules,
  plus the report, Airtable and dashboard text and numbers.
- `npm run db:types` regenerates `src/lib/database.types.ts` from the migrations. Run it after adding a migration.

## Seed data

- `supabase/seed/shelves.csv` is loaded into the database by the `seed_hubs_shelves` migration.
- `supabase/seed/past_visits.json` holds past visits for a later import step.
- `docs/sample-report.docx` is the report layout to match. Other real reports in `docs/` are kept out of git.
