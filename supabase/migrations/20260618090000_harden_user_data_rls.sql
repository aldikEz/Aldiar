-- Hardening pass for user data. Keep every user-scoped table protected at the
-- database layer, even if frontend code changes later.

do $$
begin
  if to_regclass('public.entries') is not null then
    execute 'alter table public.entries enable row level security';
    execute 'alter table public.entries force row level security';

    execute 'revoke all on table public.entries from anon';
    execute 'grant select, insert, update, delete on table public.entries to authenticated';

    execute 'drop policy if exists "read own entries" on public.entries';
    execute 'drop policy if exists "insert own entries" on public.entries';
    execute 'drop policy if exists "update own entries" on public.entries';
    execute 'drop policy if exists "delete own entries" on public.entries';

    execute 'create policy "read own entries"
      on public.entries
      for select
      to authenticated
      using (user_id = auth.uid())';

    execute 'create policy "insert own entries"
      on public.entries
      for insert
      to authenticated
      with check (user_id = auth.uid())';

    execute 'create policy "update own entries"
      on public.entries
      for update
      to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid())';

    execute 'create policy "delete own entries"
      on public.entries
      for delete
      to authenticated
      using (user_id = auth.uid())';
  end if;
end $$;

do $$
begin
  if to_regclass('public.profiles') is not null then
    execute 'alter table public.profiles enable row level security';
    execute 'alter table public.profiles force row level security';

    execute 'revoke all on table public.profiles from anon';
    execute 'grant select, insert, update, delete on table public.profiles to authenticated';

    execute 'drop policy if exists "Managers and admins can manage profiles" on public.profiles';
    execute 'drop policy if exists "Clients can view own profile" on public.profiles';
    execute 'drop policy if exists "Clients can create own profile" on public.profiles';
    execute 'drop policy if exists "Clients can update own profile" on public.profiles';

    execute 'create policy "Managers and admins can manage profiles"
      on public.profiles
      for all
      to authenticated
      using (public.current_user_role() in (''manager'', ''admin''))
      with check (public.current_user_role() in (''manager'', ''admin''))';

    execute 'create policy "Clients can view own profile"
      on public.profiles
      for select
      to authenticated
      using (id = auth.uid())';

    execute 'create policy "Clients can create own profile"
      on public.profiles
      for insert
      to authenticated
      with check (id = auth.uid() and role = ''client'')';

    execute 'create policy "Clients can update own profile"
      on public.profiles
      for update
      to authenticated
      using (id = auth.uid())
      with check (id = auth.uid() and role = ''client'')';
  end if;
end $$;

do $$
begin
  if to_regclass('public.parcels') is not null then
    execute 'alter table public.parcels enable row level security';
    execute 'alter table public.parcels force row level security';

    execute 'revoke all on table public.parcels from anon';
    execute 'grant select, insert, update, delete on table public.parcels to authenticated';

    execute 'drop policy if exists "Managers and admins can manage parcels" on public.parcels';
    execute 'drop policy if exists "Clients can view own parcels" on public.parcels';

    execute 'create policy "Managers and admins can manage parcels"
      on public.parcels
      for all
      to authenticated
      using (public.current_user_role() in (''manager'', ''admin''))
      with check (public.current_user_role() in (''manager'', ''admin''))';

    execute 'create policy "Clients can view own parcels"
      on public.parcels
      for select
      to authenticated
      using (
        cargo_code = (
          select p.cargo_code
          from public.profiles p
          where p.id = auth.uid()
        )
      )';
  end if;
end $$;
