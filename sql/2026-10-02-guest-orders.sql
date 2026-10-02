-- Admin orders for people without a user account. Safe to re-run.

alter table public.orders alter column auth_uid drop not null;

alter table public.orders add column if not exists guest_name text;
alter table public.orders add column if not exists guest_kennitala text;
alter table public.orders add column if not exists guest_email text;
alter table public.orders add column if not exists guest_phone text;
alter table public.orders add column if not exists guest_address text;
alter table public.orders add column if not exists guest_city text;
alter table public.orders add column if not exists guest_postal_code text;
