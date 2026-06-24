create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  username text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_unique unique (username),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,24}$'),
  constraint profiles_full_name_length check (char_length(trim(full_name)) between 1 and 80)
);

alter table public.profiles
  add column if not exists user_id uuid references auth.users (id) on delete cascade,
  add column if not exists full_name text,
  add column if not exists username text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.profiles
  set full_name = 'SensiBite user'
  where full_name is null or length(trim(full_name)) = 0;

update public.profiles
  set username = concat('user_', replace(gen_random_uuid()::text, '-', '')::text)
  where username is null or length(trim(username)) < 3;

alter table public.profiles
  alter column full_name set not null,
  alter column username set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_username_format'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,24}$') not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_full_name_length'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_full_name_length check (char_length(trim(full_name)) between 1 and 80) not valid;
  end if;
end $$;

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

revoke all on table public.profiles from anon;
grant select, insert, update on table public.profiles to authenticated;

drop policy if exists "read own profile" on public.profiles;
drop policy if exists "insert own profile" on public.profiles;
drop policy if exists "update own profile" on public.profiles;

create policy "read own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "insert own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "update own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create unique index if not exists profiles_username_unique_idx
  on public.profiles (username);

create index if not exists profiles_username_idx
  on public.profiles (username);
