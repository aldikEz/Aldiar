alter table public.food_events
  add column if not exists feeling_logged_at timestamptz,
  add column if not exists feeling_delay_minutes integer,
  add column if not exists food_category text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'food_events_feeling_delay_nonnegative'
      and conrelid = 'public.food_events'::regclass
  ) then
    alter table public.food_events
      add constraint food_events_feeling_delay_nonnegative
      check (feeling_delay_minutes is null or feeling_delay_minutes >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'food_events_food_category_length'
      and conrelid = 'public.food_events'::regclass
  ) then
    alter table public.food_events
      add constraint food_events_food_category_length
      check (food_category is null or char_length(food_category) between 1 and 80);
  end if;
end $$;

create index if not exists food_events_user_category_created_idx
  on public.food_events (user_id, food_category, created_at desc)
  where food_category is not null;
