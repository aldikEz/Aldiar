create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now()
);

alter table public.entries enable row level security;
alter table public.entries force row level security;

revoke all on table public.entries from anon;
grant select, insert, update, delete on table public.entries to authenticated;

drop policy if exists "read own entries" on public.entries;
drop policy if exists "insert own entries" on public.entries;
drop policy if exists "update own entries" on public.entries;
drop policy if exists "delete own entries" on public.entries;

create policy "read own entries"
  on public.entries
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "insert own entries"
  on public.entries
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "update own entries"
  on public.entries
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "delete own entries"
  on public.entries
  for delete
  to authenticated
  using (auth.uid() = user_id);

create index if not exists entries_user_created_at_idx
  on public.entries (user_id, created_at desc);
