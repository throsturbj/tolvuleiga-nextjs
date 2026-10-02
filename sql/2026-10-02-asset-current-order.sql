-- Which order is currently using this physical product. Safe to re-run.

alter table public.company_assets
  add column if not exists current_order_id uuid references public.orders(id) on delete set null;

create unique index if not exists company_assets_current_order_id_uidx
  on public.company_assets (current_order_id)
  where current_order_id is not null;
