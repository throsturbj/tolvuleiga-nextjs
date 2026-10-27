-- Only admins (users."isAdmin" = true) can read or change the Yfirlit tables,
-- and nobody can make themselves admin from the website.
-- Run after 2026-10-21-company-expenses.sql. Safe to re-run.

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where auth_uid::text = auth.uid()::text and "isAdmin" is true
  );
$$;

-- Sign-up and "Notendaupplýsingar" write the user's own row from the browser, so the database has to
-- ignore isAdmin coming from there and must not let a row be moved to another login (auth_uid).
-- Change isAdmin in the Supabase dashboard instead.
create or replace function public.protect_admin_flag()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new."isAdmin" := false;
    else
      new."isAdmin" := old."isAdmin";
      new.auth_uid := old.auth_uid;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists users_protect_admin_flag on public.users;
create trigger users_protect_admin_flag
  before insert or update on public.users
  for each row execute function public.protect_admin_flag();

alter table public.company_assets enable row level security;
alter table public.asset_revenue enable row level security;
alter table public.company_expenses enable row level security;

drop policy if exists "Authenticated all company_assets" on public.company_assets;
drop policy if exists "Authenticated all asset_revenue" on public.asset_revenue;
drop policy if exists "Authenticated all company_expenses" on public.company_expenses;

drop policy if exists "Admins all company_assets" on public.company_assets;
drop policy if exists "Admins all asset_revenue" on public.asset_revenue;
drop policy if exists "Admins all company_expenses" on public.company_expenses;

create policy "Admins all company_assets" on public.company_assets
  for all to authenticated
  using ((select public.current_user_is_admin())) with check ((select public.current_user_is_admin()));
create policy "Admins all asset_revenue" on public.asset_revenue
  for all to authenticated
  using ((select public.current_user_is_admin())) with check ((select public.current_user_is_admin()));
create policy "Admins all company_expenses" on public.company_expenses
  for all to authenticated
  using ((select public.current_user_is_admin())) with check ((select public.current_user_is_admin()));

-- Row level security and policies per table. The three Yfirlit tables should only have "Admins all ...";
-- any other policy on them still lets non-admins in.
select c.relname as table_name, c.relrowsecurity as rls_on, p.policyname, p.roles, p.cmd, p.qual
from pg_class c
join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
left join pg_policies p on p.schemaname = 'public' and p.tablename = c.relname
where c.relkind = 'r'
  and c.relname in ('company_assets', 'asset_revenue', 'company_expenses', 'users', 'orders', 'framlengingar', 'preorders')
order by c.relname, p.policyname;
