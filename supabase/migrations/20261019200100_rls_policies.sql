-- Who can do what:
--   read:   every logged-in user, every table
--   write:  inspector + admin -> visits, shelf_checks, issues, issue_updates,
--                                 staff_feedback, photos
--           admin only        -> hubs, shelves, profiles
-- Logged-out (anon) users get nothing: every policy is "to authenticated".

-- Helpers. They wrap current_user_role() from the profiles migration.
-- Policies call them as "(select ...)" so Postgres runs them once per
-- query instead of once per row.

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_role() = 'admin', false);
$$;

create function public.can_edit_visits()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_role() in ('inspector', 'admin'), false);
$$;

revoke all on function public.is_admin() from public, anon;
revoke all on function public.can_edit_visits() from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_edit_visits() to authenticated;

-- Profiles: everyone reads (so visits can show the inspector's name),
-- only admins edit. Replaces the policies from the profiles migration.

drop policy "profiles: read own or admin" on public.profiles;
drop policy "profiles: update own or admin" on public.profiles;

create policy "profiles: read" on public.profiles
  for select to authenticated using (true);

create policy "profiles: admin update" on public.profiles
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Hubs and shelves: everyone reads, admins write.

create policy "hubs: read" on public.hubs
  for select to authenticated using (true);
create policy "hubs: admin write" on public.hubs
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "shelves: read" on public.shelves
  for select to authenticated using (true);
create policy "shelves: admin write" on public.shelves
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Visits and related rows: everyone reads, inspectors and admins write.

create policy "visits: read" on public.visits
  for select to authenticated using (true);
create policy "visits: inspector write" on public.visits
  for all to authenticated
  using ((select public.can_edit_visits()))
  with check ((select public.can_edit_visits()));

create policy "shelf_checks: read" on public.shelf_checks
  for select to authenticated using (true);
create policy "shelf_checks: inspector write" on public.shelf_checks
  for all to authenticated
  using ((select public.can_edit_visits()))
  with check ((select public.can_edit_visits()));

create policy "issues: read" on public.issues
  for select to authenticated using (true);
create policy "issues: inspector write" on public.issues
  for all to authenticated
  using ((select public.can_edit_visits()))
  with check ((select public.can_edit_visits()));

create policy "issue_updates: read" on public.issue_updates
  for select to authenticated using (true);
create policy "issue_updates: inspector write" on public.issue_updates
  for all to authenticated
  using ((select public.can_edit_visits()))
  with check ((select public.can_edit_visits()));

create policy "staff_feedback: read" on public.staff_feedback
  for select to authenticated using (true);
create policy "staff_feedback: inspector write" on public.staff_feedback
  for all to authenticated
  using ((select public.can_edit_visits()))
  with check ((select public.can_edit_visits()));

create policy "photos: read" on public.photos
  for select to authenticated using (true);
create policy "photos: inspector write" on public.photos
  for all to authenticated
  using ((select public.can_edit_visits()))
  with check ((select public.can_edit_visits()));
