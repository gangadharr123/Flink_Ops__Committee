-- Core HubCheck tables. Enum values match supabase/seed/past_visits.json.
-- Row-level security is switched on here; the policies are in the next migration.

-- Enums ------------------------------------------------------------------

create type public.shelf_zone as enum ('ambient', 'fridge', 'freezer', 'dry', 'other');
create type public.zone_confidence as enum ('confirmed', 'assumed', 'check');
create type public.visit_status as enum ('draft', 'submitted');
create type public.shelf_condition as enum ('clean', 'minor_dust', 'dusty', 'mould', 'damaged');
create type public.issue_severity as enum ('low', 'medium', 'high', 'immediate');
create type public.issue_status as enum ('open', 'resolved');
create type public.issue_update_state as enum ('new', 'still_open', 'improved', 'resolved');
create type public.staff_role as enum ('picker', 'rider', 'shift_lead', 'manager', 'other');
create type public.issue_category as enum (
  'ac_leaks',
  'app_routing',
  'batteries_chargers',
  'bike_room',
  'floor',
  'fridge_freezer_equipment',
  'other',
  'process',
  'rider_safety_gear',
  'riders_room',
  'shelf_hygiene',
  'staff_welfare',
  'water_filter'
);

-- Hubs and shelves (reference data, admin-managed) ------------------------

create table public.hubs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.shelves (
  id uuid primary key default gen_random_uuid(),
  hub_id uuid not null references public.hubs (id) on delete cascade,
  number integer not null check (number > 0),
  zone public.shelf_zone not null default 'ambient',
  zone_confidence public.zone_confidence not null default 'assumed',
  note text,
  created_at timestamptz not null default now(),
  unique (hub_id, number)
);

-- Visits ------------------------------------------------------------------

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  hub_id uuid not null references public.hubs (id) on delete restrict,
  inspector_id uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  visit_date date not null,
  -- true when the real date is unknown and visit_date is a best guess
  date_is_placeholder boolean not null default false,
  visit_number integer not null check (visit_number > 0),
  label text,
  -- null = not recorded
  manager_present boolean,
  overall_impression text,
  notes text,
  status public.visit_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hub_id, visit_number)
);

create index visits_inspector_id_idx on public.visits (inspector_id);
create index visits_visit_date_idx on public.visits (visit_date);

create table public.shelf_checks (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.visits (id) on delete cascade,
  shelf_id uuid not null references public.shelves (id) on delete restrict,
  condition public.shelf_condition not null,
  -- optional score out of 5, quarter steps allowed (e.g. 3.75)
  score_5 numeric(3, 2) check (score_5 between 0 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (visit_id, shelf_id)
);

create index shelf_checks_shelf_id_idx on public.shelf_checks (shelf_id);

-- Issues: one row per problem, tracked across visits via issue_updates ------

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  -- stable human-readable id, e.g. 'D-mould'
  issue_key text not null unique,
  hub_id uuid not null references public.hubs (id) on delete restrict,
  category public.issue_category not null,
  title text not null,
  severity public.issue_severity not null,
  status public.issue_status not null default 'open',
  first_seen_visit_id uuid references public.visits (id) on delete set null,
  resolved_visit_id uuid references public.visits (id) on delete set null,
  -- hide from reports and Airtable text
  exclude_from_outputs boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index issues_hub_id_idx on public.issues (hub_id);
create index issues_first_seen_visit_id_idx on public.issues (first_seen_visit_id);
create index issues_resolved_visit_id_idx on public.issues (resolved_visit_id);

create table public.issue_updates (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues (id) on delete cascade,
  visit_id uuid not null references public.visits (id) on delete cascade,
  state public.issue_update_state not null,
  note text,
  created_at timestamptz not null default now(),
  unique (issue_id, visit_id)
);

create index issue_updates_visit_id_idx on public.issue_updates (visit_id);

-- Staff feedback: by role and tenure only. Never add a name column.
create table public.staff_feedback (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.visits (id) on delete cascade,
  staff_role public.staff_role not null,
  -- spoke to this person on an earlier visit.
  -- "returning" is a reserved word in SQL, so it must be quoted in raw SQL.
  "returning" boolean not null default false,
  tenure_note text,
  points text,
  topics text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index staff_feedback_visit_id_idx on public.staff_feedback (visit_id);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.visits (id) on delete cascade,
  issue_id uuid references public.issues (id) on delete set null,
  -- path inside the Supabase Storage bucket
  storage_path text not null unique,
  caption text,
  created_at timestamptz not null default now()
);

create index photos_visit_id_idx on public.photos (visit_id);
create index photos_issue_id_idx on public.photos (issue_id);

-- Keep updated_at fresh -------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger visits_set_updated_at
  before update on public.visits
  for each row execute function public.set_updated_at();

create trigger issues_set_updated_at
  before update on public.issues
  for each row execute function public.set_updated_at();

-- Lock everything down until the policies are added ------------------------

alter table public.hubs enable row level security;
alter table public.shelves enable row level security;
alter table public.visits enable row level security;
alter table public.shelf_checks enable row level security;
alter table public.issues enable row level security;
alter table public.issue_updates enable row level security;
alter table public.staff_feedback enable row level security;
alter table public.photos enable row level security;
