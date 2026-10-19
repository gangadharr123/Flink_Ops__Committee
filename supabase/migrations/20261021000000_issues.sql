-- Issues (Phase 4):
--   * issues.description
--   * create_issue(): issue + its first "new" update + an issue_key, in one go
--   * resolving takes effect when the visit is submitted
--   * deleting a draft deletes the issues first seen in it
--   * issue_stats view: visits seen, recurring, days open
--   * private "visit-photos" storage bucket with draft-only uploads

alter table public.issues add column description text;

-- Who may delete an issue: admins, or anyone who can still edit the draft
-- it was first seen in (to undo a mistake). Insert/update stay as before.
drop policy "issues: inspector write" on public.issues;

create policy "issues: inspector insert" on public.issues
  for insert to authenticated
  with check ((select public.can_edit_visits()));

create policy "issues: inspector update" on public.issues
  for update to authenticated
  using ((select public.can_edit_visits()))
  with check ((select public.can_edit_visits()));

create policy "issues: delete own draft issue" on public.issues
  for delete to authenticated
  using (
    (select public.is_admin())
    or (first_seen_visit_id is not null and public.visit_is_editable(first_seen_visit_id))
  );

-- Create an issue on a visit. issue_key looks like the imported ones:
-- hub initial + title words, e.g. 'D-fridge-door-handle' (-2, -3 if taken).
create function public.create_issue(
  p_visit_id uuid,
  p_category public.issue_category,
  p_title text,
  p_severity public.issue_severity,
  p_description text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_hub_id uuid;
  v_hub_name text;
  v_base text;
  v_key text;
  v_n integer := 1;
  v_id uuid;
begin
  if not public.visit_is_editable(p_visit_id) then
    raise exception 'Visit is not editable' using errcode = '42501';
  end if;
  if coalesce(trim(p_title), '') = '' then
    raise exception 'Title is required' using errcode = '22023';
  end if;

  select v.hub_id, h.name into v_hub_id, v_hub_name
  from public.visits v join public.hubs h on h.id = v.hub_id
  where v.id = p_visit_id;

  v_base := upper(left(v_hub_name, 1)) || '-' || coalesce(
    nullif(trim(both '-' from left(regexp_replace(lower(p_title), '[^a-z0-9]+', '-', 'g'), 40)), ''),
    'issue'
  );

  perform pg_advisory_xact_lock(hashtext('create_issue:' || v_base));
  v_key := v_base;
  while exists (select 1 from public.issues where issue_key = v_key) loop
    v_n := v_n + 1;
    v_key := v_base || '-' || v_n;
  end loop;

  insert into public.issues
    (issue_key, hub_id, category, title, severity, description, first_seen_visit_id)
  values
    (v_key, v_hub_id, p_category, trim(p_title), p_severity,
     nullif(trim(p_description), ''), p_visit_id)
  returning id into v_id;

  insert into public.issue_updates (issue_id, visit_id, state)
  values (v_id, p_visit_id, 'new');

  return v_id;
end;
$$;

revoke all on function public.create_issue(uuid, public.issue_category, text, public.issue_severity, text)
  from public, anon;
grant execute on function public.create_issue(uuid, public.issue_category, text, public.issue_severity, text)
  to authenticated;

-- On submit: issues marked "resolved" on this visit become resolved.
-- If an admin reopens the visit, they go back to open.
create function public.visits_apply_issue_resolutions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'submitted' and old.status = 'draft' then
    update public.issues i
    set status = 'resolved', resolved_visit_id = new.id
    from public.issue_updates u
    where u.issue_id = i.id and u.visit_id = new.id and u.state = 'resolved';
  elsif new.status = 'draft' and old.status = 'submitted' then
    update public.issues
    set status = 'open', resolved_visit_id = null
    where resolved_visit_id = new.id;
  end if;
  return null;
end;
$$;

create trigger visits_apply_issue_resolutions
  after update of status on public.visits
  for each row execute function public.visits_apply_issue_resolutions();

-- Deleting a visit deletes the issues that were first seen in it
-- (their updates and photos go with them).
create function public.visits_delete_new_issues()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  delete from public.issues where first_seen_visit_id = old.id;
  return old;
end;
$$;

create trigger visits_delete_new_issues
  before delete on public.visits
  for each row execute function public.visits_delete_new_issues();

-- Recurring ------------------------------------------------------------------

-- An issue is "recurring" when seen on this many visits (CLAUDE.md).
-- Keep in sync with RECURRING_MIN_VISITS in src/lib/issues.ts.
create function public.recurring_min_visits()
returns integer
language sql
immutable
as $$ select 3 $$;

-- Per issue: on how many visits it was seen (new, still open or improved;
-- a "resolved" update means it was gone), whether that makes it recurring,
-- and how many days it has been (or was) open.
create view public.issue_stats
with (security_invoker = true)
as
  select
    i.id as issue_id,
    count(distinct u.visit_id) filter (where u.state <> 'resolved')::integer as visits_seen,
    count(distinct u.visit_id) filter (where u.state <> 'resolved')
      >= public.recurring_min_visits() as is_recurring,
    min(v.visit_date) filter (where u.state <> 'resolved') as first_seen_date,
    max(v.visit_date) filter (where u.state <> 'resolved') as last_seen_date,
    rv.visit_date as resolved_date,
    (coalesce(rv.visit_date, (now() at time zone 'Europe/Berlin')::date)
      - coalesce(fv.visit_date, min(v.visit_date)))::integer as days_open
  from public.issues i
  left join public.issue_updates u on u.issue_id = i.id
  left join public.visits v on v.id = u.visit_id
  left join public.visits fv on fv.id = i.first_seen_visit_id
  left join public.visits rv on rv.id = i.resolved_visit_id
  group by i.id, fv.visit_date, rv.visit_date;

-- Photo storage --------------------------------------------------------------

-- Private bucket; files are stored as "<visit id>/<photo id>.jpg".
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('visit-photos', 'visit-photos', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- "abc" -> null instead of an error, for reading ids out of file paths.
create function public.safe_uuid(p_text text)
returns uuid
language plpgsql
immutable
as $$
begin
  return p_text::uuid;
exception when others then
  return null;
end;
$$;

create policy "visit-photos: read" on storage.objects
  for select to authenticated
  using (bucket_id = 'visit-photos');

create policy "visit-photos: upload while draft" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'visit-photos'
    and public.visit_is_editable(public.safe_uuid((storage.foldername(name))[1]))
  );

create policy "visit-photos: delete while draft" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'visit-photos'
    and public.visit_is_editable(public.safe_uuid((storage.foldername(name))[1]))
  );
