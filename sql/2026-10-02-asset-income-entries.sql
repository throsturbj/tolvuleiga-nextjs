-- Yfirlit: each income is its own numbered entry, not a monthly total.
-- Safe to re-run.

alter table public.asset_revenue drop constraint if exists asset_revenue_asset_id_year_month_key;
alter table public.asset_revenue drop constraint if exists asset_revenue_month_check;

alter table public.asset_revenue alter column year drop not null;
alter table public.asset_revenue alter column month drop not null;

drop index if exists public.asset_revenue_period_idx;
create index if not exists asset_revenue_asset_id_idx on public.asset_revenue (asset_id, created_at);

alter table public.asset_revenue
  add column if not exists order_id uuid references public.orders(id) on delete set null;

create unique index if not exists asset_revenue_order_id_uidx
  on public.asset_revenue (order_id)
  where order_id is not null;
