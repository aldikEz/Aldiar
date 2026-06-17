alter table public.key_purchases
  add column if not exists customer_token text,
  add column if not exists telegram_username text,
  add column if not exists item_title text;

alter table public.key_purchases
  alter column customer_id drop not null,
  alter column catalog_item_id drop not null,
  alter column buyer_user_id drop not null;

alter table public.key_purchases
  drop constraint if exists key_purchases_status_check,
  drop constraint if exists key_purchases_check;

alter table public.key_purchases
  add constraint key_purchases_status_check check (
    status in (
      'pending',
      'pending_payment',
      'verifying_payment',
      'paid',
      'delivered',
      'key_sent',
      'cancelled',
      'refunded'
    )
  ),
  add constraint key_purchases_delivery_check check (
    (status in ('delivered', 'key_sent') and delivered_at is not null)
    or (status not in ('delivered', 'key_sent'))
  );

drop policy if exists "Token users can create purchases" on public.key_purchases;
drop policy if exists "Token users can view own purchases" on public.key_purchases;

create policy "Token users can create purchases"
  on public.key_purchases
  for insert
  to anon, authenticated
  with check (
    customer_token is not null
    and length(trim(customer_token)) >= 12
    and status in ('pending', 'pending_payment', 'verifying_payment')
    and digital_key is null
  );

create policy "Token users can view own purchases"
  on public.key_purchases
  for select
  to anon, authenticated
  using (
    customer_token is not null
    and customer_token = nullif(coalesce(current_setting('request.headers', true), '{}')::json ->> 'x-customer-token', '')
  );

create index if not exists key_purchases_customer_token_idx
  on public.key_purchases (customer_token);
