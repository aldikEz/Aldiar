create table if not exists public.user_daily_state (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null default current_date,
  water_ml integer not null default 0 check (water_ml between 0 and 20000),
  water_unit text not null default 'oz' check (water_unit in ('oz', 'ml')),
  streak_count integer not null default 0 check (streak_count between 0 and 365),
  streak_max_count integer not null default 0 check (streak_max_count between 0 and 365),
  streak_last_logged_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.user_daily_state enable row level security;
alter table public.user_daily_state force row level security;

revoke all on table public.user_daily_state from anon;
grant select, insert, update, delete on table public.user_daily_state to authenticated;

drop policy if exists "read own daily state" on public.user_daily_state;
drop policy if exists "insert own daily state" on public.user_daily_state;
drop policy if exists "update own daily state" on public.user_daily_state;
drop policy if exists "delete own daily state" on public.user_daily_state;

create policy "read own daily state"
  on public.user_daily_state
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "insert own daily state"
  on public.user_daily_state
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "update own daily state"
  on public.user_daily_state
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "delete own daily state"
  on public.user_daily_state
  for delete
  to authenticated
  using (auth.uid() = user_id);

create index if not exists user_daily_state_user_day_idx
  on public.user_daily_state (user_id, day desc);
