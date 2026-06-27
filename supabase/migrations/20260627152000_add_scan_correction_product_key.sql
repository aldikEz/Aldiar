alter table public.scan_corrections
  add column if not exists product_key text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'scan_corrections_product_key_length'
      and conrelid = 'public.scan_corrections'::regclass
  ) then
    alter table public.scan_corrections
      add constraint scan_corrections_product_key_length
      check (product_key is null or char_length(product_key) between 1 and 160);
  end if;
end $$;

create index if not exists scan_corrections_user_product_key_updated_idx
  on public.scan_corrections (user_id, product_key, updated_at desc)
  where product_key is not null;
