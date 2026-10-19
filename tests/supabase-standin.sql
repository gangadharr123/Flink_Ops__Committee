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

-- Supabase Storage keeps files' metadata in these tables, protected by RLS.
create schema storage;

create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null,
  owner uuid default auth.uid(),
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;

-- "a/b/c.jpg" -> {a,b}: the folders of a file path.
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;

grant usage on schema public, auth, storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
