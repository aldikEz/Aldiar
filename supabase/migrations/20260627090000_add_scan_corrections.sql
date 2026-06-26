create table if not exists public.scan_corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  local_scan_id text not null,
  original_result jsonb not null,
  corrected_result jsonb not null,
  corrected_nutrition jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scan_corrections_local_scan_id_length check (char_length(local_scan_id) between 1 and 160),
  constraint scan_corrections_user_local_unique unique (user_id, local_scan_id)
);

alter table public.scan_corrections enable row level security;
alter table public.scan_corrections force row level security;

revoke all on table public.scan_corrections from anon;
grant select, insert, update, delete on table public.scan_corrections to authenticated;

drop policy if exists "read own scan corrections" on public.scan_corrections;
drop policy if exists "insert own scan corrections" on public.scan_corrections;
drop policy if exists "update own scan corrections" on public.scan_corrections;
drop policy if exists "delete own scan corrections" on public.scan_corrections;

create policy "read own scan corrections"
  on public.scan_corrections
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "insert own scan corrections"
  on public.scan_corrections
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "update own scan corrections"
  on public.scan_corrections
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "delete own scan corrections"
  on public.scan_corrections
  for delete
  to authenticated
  using (auth.uid() = user_id);

create index if not exists scan_corrections_user_updated_at_idx
  on public.scan_corrections (user_id, updated_at desc);
