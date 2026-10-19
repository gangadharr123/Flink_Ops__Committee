-- Profiles: one row per login (auth.users), holding the app role.
-- These are app users (inspectors, the manager), not hub staff.

create type public.user_role as enum ('inspector', 'viewer', 'admin');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  -- Least privilege: new users can only look until an admin promotes them.
  role public.user_role not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Role of the logged-in user. "security definer" lets it read profiles
-- without going through RLS, which avoids policies calling themselves.
create function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

revoke all on function public.current_user_role() from public, anon;
grant execute on function public.current_user_role() to authenticated;

-- Read: your own profile; admins read all.
create policy "profiles: read own or admin"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or public.current_user_role() = 'admin');

-- Update: your own profile (name only, see trigger below); admins update all.
create policy "profiles: update own or admin"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()) or public.current_user_role() = 'admin')
  with check (id = (select auth.uid()) or public.current_user_role() = 'admin');

-- No insert/delete policies: rows are created by the trigger below and
-- removed when the auth user is deleted.

-- Stop non-admins from changing their own role, and keep updated_at fresh.
create function public.profiles_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- auth.uid() is null in the Supabase SQL editor, so admins can bootstrap there.
  if new.role is distinct from old.role
     and (select auth.uid()) is not null
     and public.current_user_role() is distinct from 'admin' then
    raise exception 'Only admins can change roles';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_before_update
  before update on public.profiles
  for each row execute function public.profiles_before_update();

-- Create a profile automatically when a new auth user is created.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users that already exist.
insert into public.profiles (id, full_name)
select id, raw_user_meta_data ->> 'full_name' from auth.users
on conflict (id) do nothing;

-- To make yourself admin, run once in the SQL editor:
--   update public.profiles set role = 'admin', full_name = 'Your Name'
--   where id = (select id from auth.users where email = 'you@example.com');
