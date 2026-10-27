-- Yfirlit: kostnaður (auglýsingar, aðrar vörur, rekstrarkostnaður) is one row per cost, just a name and a price.
-- All categories live in company_expenses. Safe to re-run.

create table if not exists public.company_expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'Annað',
  name text,
  year integer,
  month integer check (month between 1 and 12),
  amount integer not null default 0,
  note text,
  created_at timestamptz not null default now()
);

alter table public.company_expenses add column if not exists name text;
alter table public.company_expenses alter column year drop not null;
alter table public.company_expenses alter column month drop not null;

create index if not exists company_expenses_category_idx on public.company_expenses (category, created_at);

alter table public.company_expenses enable row level security;

-- Admin-only access policies: sql/2026-10-21-admin-only.sql

grant select, insert, update, delete on public.company_expenses to authenticated;
