-- Admin overview: company assets, monthly booked revenue, operating expenses.
-- Safe to re-run.

create table if not exists public.company_assets (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  purchase_date date,
  purchase_cost integer not null default 0,
  notes text,
  current_order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.asset_revenue (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.company_assets(id) on delete cascade,
  amount integer not null default 0,
  year integer,
  month integer,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.company_expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'Annað',
  year integer not null,
  month integer not null check (month between 1 and 12),
  amount integer not null default 0,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists company_assets_product_id_idx on public.company_assets (product_id);
create unique index if not exists company_assets_current_order_id_uidx on public.company_assets (current_order_id) where current_order_id is not null;
create index if not exists asset_revenue_asset_id_idx on public.asset_revenue (asset_id, created_at);
create unique index if not exists asset_revenue_order_id_uidx on public.asset_revenue (order_id) where order_id is not null;
create index if not exists company_expenses_period_idx on public.company_expenses (year, month);

alter table public.company_assets enable row level security;
alter table public.asset_revenue enable row level security;
alter table public.company_expenses enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'company_assets' and policyname = 'Authenticated all company_assets') then
    create policy "Authenticated all company_assets" on public.company_assets for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'asset_revenue' and policyname = 'Authenticated all asset_revenue') then
    create policy "Authenticated all asset_revenue" on public.asset_revenue for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'company_expenses' and policyname = 'Authenticated all company_expenses') then
    create policy "Authenticated all company_expenses" on public.company_expenses for all to authenticated using (true) with check (true);
  end if;
end $$;

grant select, insert, update, delete on public.company_assets, public.asset_revenue, public.company_expenses to authenticated;
