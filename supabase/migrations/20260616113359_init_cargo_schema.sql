create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  role text not null default 'client' check (role in ('client', 'manager', 'admin')),
  cargo_code text not null unique
);

create table if not exists public.parcels (
  id uuid primary key default gen_random_uuid(),
  tracking_number text not null unique,
  cargo_code text not null,
  weight numeric(10, 2) check (weight is null or weight >= 0),
  status text not null default 'received_china' check (
    status in ('received_china', 'on_the_way', 'arrived_kz', 'issued')
  ),
  shelf_number text
);

alter table public.profiles enable row level security;
alter table public.parcels enable row level security;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
$$;

create policy "Managers and admins can manage profiles"
  on public.profiles
  for all
  to authenticated
  using (public.current_user_role() in ('manager', 'admin'))
  with check (public.current_user_role() in ('manager', 'admin'));

create policy "Clients can view own profile"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

create policy "Managers and admins can manage parcels"
  on public.parcels
  for all
  to authenticated
  using (public.current_user_role() in ('manager', 'admin'))
  with check (public.current_user_role() in ('manager', 'admin'));

create policy "Clients can view own parcels"
  on public.parcels
  for select
  to authenticated
  using (
    cargo_code = (
      select p.cargo_code
      from public.profiles p
      where p.id = auth.uid()
    )
  );

create index if not exists parcels_tracking_number_idx
  on public.parcels (tracking_number);

create index if not exists parcels_cargo_code_idx
  on public.parcels (cargo_code);

create index if not exists profiles_cargo_code_idx
  on public.profiles (cargo_code);
