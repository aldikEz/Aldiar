-- Reassert the DigestSnap private-data security baseline.
-- User-owned tables must stay readable/writable only through authenticated RLS policies.
-- Shared AI cache remains service-role only.

alter table if exists public.entries enable row level security;
alter table if exists public.entries force row level security;
revoke all on table public.entries from anon;
grant select, insert, update, delete on table public.entries to authenticated;

alter table if exists public.profiles enable row level security;
alter table if exists public.profiles force row level security;
revoke all on table public.profiles from anon;
grant select, insert, update on table public.profiles to authenticated;

alter table if exists public.scan_corrections enable row level security;
alter table if exists public.scan_corrections force row level security;
revoke all on table public.scan_corrections from anon;
grant select, insert, update, delete on table public.scan_corrections to authenticated;

alter table if exists public.food_events enable row level security;
alter table if exists public.food_events force row level security;
revoke all on table public.food_events from anon;
grant select, insert, update, delete on table public.food_events to authenticated;

alter table if exists public.cached_labels enable row level security;
alter table if exists public.cached_labels force row level security;
revoke all on table public.cached_labels from anon;
revoke all on table public.cached_labels from authenticated;
