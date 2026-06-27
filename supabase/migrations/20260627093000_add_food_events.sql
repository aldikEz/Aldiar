create table if not exists public.food_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  local_scan_id text not null,
  product_name text not null,
  rating text not null check (rating in ('Safe', 'Caution', 'Avoid')),
  score integer not null check (score between 0 and 100),
  result jsonb not null,
  nutrition jsonb not null,
  image_data_url text,
  eaten boolean,
  feeling text check (feeling in ('Fine', 'Bloated', 'Pain', 'Nausea')),
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint food_events_local_scan_id_length check (char_length(local_scan_id) between 1 and 160),
  constraint food_events_product_name_length check (char_length(trim(product_name)) between 1 and 160),
  constraint food_events_user_local_unique unique (user_id, local_scan_id)
);

alter table public.food_events enable row level security;
alter table public.food_events force row level security;

revoke all on table public.food_events from anon;
grant select, insert, update, delete on table public.food_events to authenticated;

drop policy if exists "read own food events" on public.food_events;
drop policy if exists "insert own food events" on public.food_events;
drop policy if exists "update own food events" on public.food_events;
drop policy if exists "delete own food events" on public.food_events;

create policy "read own food events"
  on public.food_events
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "insert own food events"
  on public.food_events
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "update own food events"
  on public.food_events
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "delete own food events"
  on public.food_events
  for delete
  to authenticated
  using (auth.uid() = user_id);

create index if not exists food_events_user_created_at_idx
  on public.food_events (user_id, created_at desc);

create index if not exists food_events_user_consumed_at_idx
  on public.food_events (user_id, consumed_at desc)
  where consumed_at is not null;
