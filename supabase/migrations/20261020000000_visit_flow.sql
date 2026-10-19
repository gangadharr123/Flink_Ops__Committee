-- Visit flow (Phase 3):
--   * remember which step a draft is on
--   * create_visit(): next visit number + pre-fill shelf checks, in one go
--   * submitted visits are read-only for inspectors (admins can still fix them)

create type public.visit_step as enum ('shelves', 'issues', 'staff', 'summary');

alter table public.visits
  add column current_step public.visit_step not null default 'shelves',
  add column submitted_at timestamptz,
  -- the submitted visit whose shelf checks pre-filled this one
  add column previous_visit_id uuid references public.visits (id) on delete set null;

create index visits_previous_visit_id_idx on public.visits (previous_visit_id);

-- Stamp submitted_at when a visit is submitted (cleared if an admin reopens it).
create function public.visits_set_submitted_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'submitted' and old.status is distinct from 'submitted' then
    new.submitted_at := now();
  elsif new.status = 'draft' then
    new.submitted_at := null;
  end if;
  return new;
end;
$$;

create trigger visits_set_submitted_at
  before update on public.visits
  for each row execute function public.visits_set_submitted_at();

-- Can the current user change rows that belong to this visit?
-- Admins: always. Inspectors: only while the visit is a draft.
create function public.visit_is_editable(p_visit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin()
    or (
      public.can_edit_visits()
      and exists (
        select 1 from public.visits v
        where v.id = p_visit_id and v.status = 'draft'
      )
    );
$$;

revoke all on function public.visit_is_editable(uuid) from public, anon;
grant execute on function public.visit_is_editable(uuid) to authenticated;

-- Visits: replace the "inspector write" policy with draft-aware ones.
drop policy "visits: inspector write" on public.visits;

create policy "visits: insert draft" on public.visits
  for insert to authenticated
  with check (
    (select public.is_admin())
    or ((select public.can_edit_visits()) and status = 'draft')
  );

-- "using" checks the row before the change, so inspectors can only touch
-- drafts. "with check" allows the new row to be submitted (draft -> submitted).
create policy "visits: update draft" on public.visits
  for update to authenticated
  using (
    (select public.is_admin())
    or ((select public.can_edit_visits()) and status = 'draft')
  )
  with check ((select public.can_edit_visits()));

create policy "visits: delete draft" on public.visits
  for delete to authenticated
  using (
    (select public.is_admin())
    or ((select public.can_edit_visits()) and status = 'draft')
  );

-- Rows that belong to a visit: writable only while that visit is editable.
drop policy "shelf_checks: inspector write" on public.shelf_checks;
create policy "shelf_checks: write while draft" on public.shelf_checks
  for all to authenticated
  using (public.visit_is_editable(visit_id))
  with check (public.visit_is_editable(visit_id));

drop policy "issue_updates: inspector write" on public.issue_updates;
create policy "issue_updates: write while draft" on public.issue_updates
  for all to authenticated
  using (public.visit_is_editable(visit_id))
  with check (public.visit_is_editable(visit_id));

drop policy "staff_feedback: inspector write" on public.staff_feedback;
create policy "staff_feedback: write while draft" on public.staff_feedback
  for all to authenticated
  using (public.visit_is_editable(visit_id))
  with check (public.visit_is_editable(visit_id));

drop policy "photos: inspector write" on public.photos;
create policy "photos: write while draft" on public.photos
  for all to authenticated
  using (public.visit_is_editable(visit_id))
  with check (public.visit_is_editable(visit_id));

-- Create a draft visit: next number for the hub, and copy condition + score
-- (not comments, they go stale) from the hub's latest submitted visit.
-- "security invoker" = runs as the caller, so the RLS rules above still apply.
create function public.create_visit(p_hub_id uuid, p_visit_date date)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_number integer;
  v_previous uuid;
  v_id uuid;
begin
  -- Stop two taps at once from both getting the same number.
  perform pg_advisory_xact_lock(hashtext('create_visit:' || p_hub_id::text));

  select coalesce(max(visit_number), 0) + 1 into v_number
  from public.visits where hub_id = p_hub_id;

  select id into v_previous
  from public.visits
  where hub_id = p_hub_id and status = 'submitted'
  order by visit_number desc
  limit 1;

  insert into public.visits (hub_id, visit_date, visit_number, label, previous_visit_id)
  values (p_hub_id, p_visit_date, v_number, 'Visit ' || v_number, v_previous)
  returning id into v_id;

  if v_previous is not null then
    insert into public.shelf_checks (visit_id, shelf_id, condition, score_5)
    select v_id, shelf_id, condition, score_5
    from public.shelf_checks
    where visit_id = v_previous;
  end if;

  return v_id;
end;
$$;

revoke all on function public.create_visit(uuid, date) from public, anon;
grant execute on function public.create_visit(uuid, date) to authenticated;

-- Topic tags used so far, most used first, for suggestions in the staff step.
create view public.staff_topics
with (security_invoker = true)
as
  select topic, count(*)::integer as uses
  from public.staff_feedback, unnest(topics) as topic
  group by topic
  order by uses desc, topic;
