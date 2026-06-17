drop table if exists public.sniper_users, public.market_niches, public.kaspi_market_niches, public.saved_calculations cascade;

create table public.game_customers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null unique default auth.uid() references auth.users(id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  full_name text,
  phone text
);

create table public.digital_keys_catalog (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null,
  platform text not null check (
    platform in ('steam', 'epic_games', 'xbox', 'playstation', 'nintendo', 'ea_app', 'ubisoft', 'rockstar', 'other')
  ),
  region text not null default 'global' check (
    region in ('global', 'kz', 'cis', 'eu', 'us', 'tr', 'other')
  ),
  activation_type text not null default 'key' check (
    activation_type in ('key', 'gift', 'code', 'account')
  ),
  genre text not null,
  description text,
  cover_url text,
  price_tenge integer not null check (price_tenge >= 0),
  stock_count integer not null default 0 check (stock_count >= 0),
  is_active boolean not null default true,
  is_featured boolean not null default false
);

create table public.key_purchases (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  customer_id uuid not null references public.game_customers(id) on delete cascade,
  catalog_item_id uuid not null references public.digital_keys_catalog(id) on delete restrict,
  buyer_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status text not null default 'pending_payment' check (
    status in ('pending_payment', 'paid', 'key_sent', 'cancelled', 'refunded')
  ),
  payment_method text not null default 'kaspi_qr' check (
    payment_method in ('kaspi_qr', 'kaspi_transfer', 'card', 'manual')
  ),
  amount_tenge integer not null check (amount_tenge >= 0),
  digital_key text check (digital_key is null or length(trim(digital_key)) > 0),
  delivered_at timestamptz,
  check (
    (status = 'key_sent' and delivered_at is not null)
    or (status <> 'key_sent')
  )
);

create or replace function public.is_games_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
$$;

alter table public.game_customers enable row level security;
alter table public.digital_keys_catalog enable row level security;
alter table public.key_purchases enable row level security;

create policy "Users can create own customer profile"
  on public.game_customers
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can view own customer profile"
  on public.game_customers
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can update own customer profile"
  on public.game_customers
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Admins can manage customers"
  on public.game_customers
  for all
  to authenticated
  using (public.is_games_admin())
  with check (public.is_games_admin());

create policy "Anyone can view active digital keys"
  on public.digital_keys_catalog
  for select
  to anon, authenticated
  using (is_active = true);

create policy "Admins can manage digital keys"
  on public.digital_keys_catalog
  for all
  to authenticated
  using (public.is_games_admin())
  with check (public.is_games_admin());

create policy "Users can create own purchases"
  on public.key_purchases
  for insert
  to authenticated
  with check (
    buyer_user_id = auth.uid()
    and status = 'pending_payment'
    and digital_key is null
    and exists (
      select 1
      from public.game_customers c
      where c.id = customer_id
        and c.user_id = auth.uid()
    )
  );

create policy "Users can view own purchases"
  on public.key_purchases
  for select
  to authenticated
  using (
    buyer_user_id = auth.uid()
    or exists (
      select 1
      from public.game_customers c
      where c.id = customer_id
        and c.user_id = auth.uid()
    )
  );

create policy "Admins can manage purchases"
  on public.key_purchases
  for all
  to authenticated
  using (public.is_games_admin())
  with check (public.is_games_admin());

create index game_customers_user_id_idx
  on public.game_customers (user_id);

create index game_customers_email_idx
  on public.game_customers (email);

create index digital_keys_catalog_active_idx
  on public.digital_keys_catalog (is_active);

create index digital_keys_catalog_platform_idx
  on public.digital_keys_catalog (platform);

create index digital_keys_catalog_featured_idx
  on public.digital_keys_catalog (is_featured);

create index digital_keys_catalog_price_idx
  on public.digital_keys_catalog (price_tenge);

create index key_purchases_customer_id_idx
  on public.key_purchases (customer_id);

create index key_purchases_buyer_user_id_idx
  on public.key_purchases (buyer_user_id);

create index key_purchases_catalog_item_id_idx
  on public.key_purchases (catalog_item_id);

create index key_purchases_status_idx
  on public.key_purchases (status);

create index key_purchases_created_at_idx
  on public.key_purchases (created_at desc);
