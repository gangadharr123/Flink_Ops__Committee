-- The parts of Supabase our migrations rely on, for running them in plain
-- Postgres (PGlite) in tests and type generation. Not run in Supabase.

create role anon nologin;
create role authenticated nologin;

create schema auth;

create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'
);

-- The logged-in user's id. Tests set it with set_config('request.jwt.claim.sub', ...).
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant usage on schema public, auth to anon, authenticated;
