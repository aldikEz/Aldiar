-- Cached AI scans are internal server cache only.
-- Client apps must never read/write shared cached results directly.

alter table public.cached_labels enable row level security;
alter table public.cached_labels force row level security;

revoke all on table public.cached_labels from anon;
revoke all on table public.cached_labels from authenticated;

drop policy if exists "read cached labels" on public.cached_labels;
drop policy if exists "insert cached labels" on public.cached_labels;
drop policy if exists "update cached labels" on public.cached_labels;
drop policy if exists "delete cached labels" on public.cached_labels;
