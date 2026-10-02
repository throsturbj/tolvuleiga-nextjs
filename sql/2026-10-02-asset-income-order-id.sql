-- Link an order to an income row. Safe to re-run.

alter table public.asset_revenue
  add column if not exists order_id uuid references public.orders(id) on delete set null;

create unique index if not exists asset_revenue_order_id_uidx
  on public.asset_revenue (order_id)
  where order_id is not null;
