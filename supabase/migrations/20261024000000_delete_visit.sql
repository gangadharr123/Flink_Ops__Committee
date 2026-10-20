-- Deleting a visit (admins: any visit; inspectors: their drafts).
--
-- Who may delete is unchanged and enforced by the "visits: delete draft"
-- policy (visit_flow migration): admins always, inspectors only drafts.
-- Shelf checks, staff feedback, photos (rows), issue updates and Airtable
-- answers are removed by "on delete cascade". Photo files in Storage are
-- removed by the app first (storage rules allow admins and draft owners).
--
-- This replaces the issue clean-up from the issues migration, which deleted
-- every issue first seen on the visit, even ones later visits also recorded.
-- Now:
--   * issues recorded only on this visit are deleted
--   * issues other visits also recorded stay, rebuilt from the remaining
--     updates: first seen = earliest remaining visit (its update becomes
--     "new"), status and resolved visit from the latest submitted update
--
-- security definer: the clean-up must also touch rows of other (submitted)
-- visits. It only runs for a visit the user was allowed to delete, because
-- row-level security filters the delete before this trigger fires.

create or replace function public.visits_delete_new_issues()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected uuid[];
begin
  -- 1. Issues recorded on no other visit: delete (their updates cascade).
  delete from public.issues i
  where i.first_seen_visit_id = old.id
    and not exists (
      select 1 from public.issue_updates u
      where u.issue_id = i.id and u.visit_id <> old.id
    );

  -- 2. Issues that remain but are linked to this visit.
  select array_agg(i.id) into affected
  from public.issues i
  where i.first_seen_visit_id = old.id
     or i.resolved_visit_id = old.id
     or exists (
       select 1 from public.issue_updates u
       where u.issue_id = i.id and u.visit_id = old.id
     );
  if affected is null then
    return old;
  end if;

  -- The earliest remaining update is now the first: make it "new".
  update public.issue_updates u
  set state = 'new'
  from (
    select distinct on (u2.issue_id) u2.id
    from public.issue_updates u2
    join public.visits v on v.id = u2.visit_id
    where u2.issue_id = any (affected) and u2.visit_id <> old.id
    order by u2.issue_id, v.visit_date, v.visit_number
  ) first_update
  where u.id = first_update.id and u.state <> 'new';

  -- First seen, status and resolved visit from the remaining updates.
  -- Resolving only counts on submitted visits (as on submit).
  update public.issues i
  set
    first_seen_visit_id = (
      select u.visit_id
      from public.issue_updates u join public.visits v on v.id = u.visit_id
      where u.issue_id = i.id and u.visit_id <> old.id
      order by v.visit_date, v.visit_number
      limit 1
    ),
    resolved_visit_id = (
      select case when u.state = 'resolved' then u.visit_id end
      from public.issue_updates u join public.visits v on v.id = u.visit_id
      where u.issue_id = i.id and u.visit_id <> old.id and v.status = 'submitted'
      order by v.visit_date desc, v.visit_number desc
      limit 1
    ),
    status = coalesce((
      select case when u.state = 'resolved'
                  then 'resolved'::public.issue_status
                  else 'open'::public.issue_status end
      from public.issue_updates u join public.visits v on v.id = u.visit_id
      where u.issue_id = i.id and u.visit_id <> old.id and v.status = 'submitted'
      order by v.visit_date desc, v.visit_number desc
      limit 1
    ), 'open'::public.issue_status)
  where i.id = any (affected);

  return old;
end;
$$;

revoke all on function public.visits_delete_new_issues() from public, anon, authenticated;
