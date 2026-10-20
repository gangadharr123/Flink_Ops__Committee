-- Edited Airtable answers per visit. Only fields you changed are stored
-- (field key -> text); the rest are generated from the visit data.
-- A separate table, not a visits column: answers stay editable after the
-- visit is submitted, while the visit itself is read-only.

create table public.airtable_answers (
  visit_id uuid primary key references public.visits (id) on delete cascade,
  answers jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references public.profiles (id) on delete set null
);

alter table public.airtable_answers enable row level security;

create policy "airtable_answers: read" on public.airtable_answers
  for select to authenticated using (true);

create policy "airtable_answers: inspector write" on public.airtable_answers
  for all to authenticated
  using ((select public.can_edit_visits()))
  with check ((select public.can_edit_visits()));

create trigger airtable_answers_set_updated_at
  before update on public.airtable_answers
  for each row execute function public.set_updated_at();
