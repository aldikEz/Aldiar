-- Cache AI label scans by image hash. The service-role Edge Function writes here;
-- clients do not get direct table access.

create table if not exists public.cached_labels (
  id uuid primary key default gen_random_uuid(),
  image_hash text not null,
  target_language text not null default 'English',
  product_name text not null,
  scan_result jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cached_labels_image_language_key unique (image_hash, target_language),
  constraint cached_labels_image_hash_check check (length(image_hash) = 64),
  constraint cached_labels_target_language_check check (length(trim(target_language)) between 2 and 40),
  constraint cached_labels_product_name_check check (length(trim(product_name)) > 0)
);

create index if not exists cached_labels_product_name_idx
  on public.cached_labels (lower(product_name));

alter table public.cached_labels enable row level security;
