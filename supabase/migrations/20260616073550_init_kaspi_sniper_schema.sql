create table public.sniper_users (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_token text not null unique,
  is_premium_active boolean not null default false
);

create table public.kaspi_market_niches (
  id uuid primary key default gen_random_uuid(),
  category_name text not null,
  item_title text not null,
  active_competitors_count integer not null check (active_competitors_count >= 0),
  monthly_estimated_sales integer not null check (monthly_estimated_sales >= 0),
  baraholka_wholesale_price integer not null check (baraholka_wholesale_price >= 0),
  kaspi_retail_price integer not null check (kaspi_retail_price >= 0),
  is_hidden_trend boolean not null default true
);

create table public.saved_calculations (
  id uuid primary key default gen_random_uuid(),
  user_token text not null,
  item_name text not null,
  custom_buy_price integer not null check (custom_buy_price >= 0),
  custom_sell_price integer not null check (custom_sell_price >= 0),
  calculated_roi numeric not null
);

create or replace function public.request_session_token()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'session_token', '')
$$;

create or replace function public.is_sniper_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
$$;

create or replace function public.has_active_sniper_premium()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sniper_users u
    where u.session_token = public.request_session_token()
      and u.is_premium_active = true
  )
$$;

alter table public.sniper_users enable row level security;
alter table public.kaspi_market_niches enable row level security;
alter table public.saved_calculations enable row level security;

create policy "Anyone can create free session"
  on public.sniper_users
  for insert
  to anon, authenticated
  with check (is_premium_active = false);

create policy "Users can view own session"
  on public.sniper_users
  for select
  to anon, authenticated
  using (session_token = public.request_session_token());

create policy "Admins can manage sessions"
  on public.sniper_users
  for all
  to authenticated
  using (public.is_sniper_admin())
  with check (public.is_sniper_admin());

create policy "Anyone can view free niches"
  on public.kaspi_market_niches
  for select
  to anon, authenticated
  using (is_hidden_trend = false);

create policy "Premium users can view hidden niches"
  on public.kaspi_market_niches
  for select
  to anon, authenticated
  using (is_hidden_trend = true and public.has_active_sniper_premium());

create policy "Admins can manage niches"
  on public.kaspi_market_niches
  for all
  to authenticated
  using (public.is_sniper_admin())
  with check (public.is_sniper_admin());

create policy "Users can view own calculations"
  on public.saved_calculations
  for select
  to anon, authenticated
  using (user_token = public.request_session_token());

create policy "Users can create own calculations"
  on public.saved_calculations
  for insert
  to anon, authenticated
  with check (user_token = public.request_session_token());

create policy "Users can update own calculations"
  on public.saved_calculations
  for update
  to anon, authenticated
  using (user_token = public.request_session_token())
  with check (user_token = public.request_session_token());

create policy "Users can delete own calculations"
  on public.saved_calculations
  for delete
  to anon, authenticated
  using (user_token = public.request_session_token());

create policy "Admins can manage calculations"
  on public.saved_calculations
  for all
  to authenticated
  using (public.is_sniper_admin())
  with check (public.is_sniper_admin());

create index kaspi_market_niches_hidden_idx
  on public.kaspi_market_niches (is_hidden_trend);

create index kaspi_market_niches_category_idx
  on public.kaspi_market_niches (category_name);

create index saved_calculations_user_token_idx
  on public.saved_calculations (user_token);
