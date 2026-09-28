-- Unify product types into public.products + admin-editable product_groups.
-- Accessories (keyboards, mice, Apple extras) go to public.aukahlutir.
-- Copies existing rows; does NOT drop old tables (keep as backup until cutover is verified).
-- Repeat checkout URL columns are not copied.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.parse_isk(val text)
returns numeric
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(val, ''), '[^0-9]', '', 'g'), '')::numeric;
$$;

-- Read optional columns without failing if they were never added to the source table.
create or replace function public.jsonb_bool(j jsonb, k text, fallback boolean default false)
returns boolean
language sql
immutable
as $$
  select case
    when j ? k then coalesce((j ->> k)::boolean, fallback)
    else fallback
  end;
$$;

create or replace function public.jsonb_ts(j jsonb, k text)
returns timestamptz
language sql
immutable
as $$
  select case
    when j ? k then nullif(j ->> k, '')::timestamptz
    else null
  end;
$$;

-- ---------------------------------------------------------------------------
-- product_groups (homepage sections, admin-editable)
-- ---------------------------------------------------------------------------
create table if not exists public.product_groups (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  sort_order integer not null default 0,
  visible boolean not null default true,
  theme text not null default 'dark',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_groups_theme_check check (theme in ('dark', 'light', 'teal'))
);

comment on table public.product_groups is 'Homepage product sections; admin can add/rename/reorder.';
comment on column public.product_groups.theme is 'dark | light | teal — homepage section styling.';

insert into public.product_groups (id, slug, title, sort_order, visible, theme)
values
  ('11111111-1111-4111-8111-111111111001', 'apple-laptops', 'Apple Fartölvur', 10, true, 'dark'),
  ('11111111-1111-4111-8111-111111111002', 'ipads', 'iPad', 20, true, 'dark'),
  ('11111111-1111-4111-8111-111111111003', 'windows-laptops', 'Windows Fartölvur', 30, true, 'dark'),
  ('11111111-1111-4111-8111-111111111004', 'desktops', 'Borðtölvur', 40, true, 'light'),
  ('11111111-1111-4111-8111-111111111005', 'screens', 'Skjáir', 50, true, 'teal')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.product_groups(id) on delete set null,
  type text not null,
  name text not null,
  description text,
  innifalid text,
  price numeric,
  trygging numeric,
  specs jsonb not null default '{}'::jsonb,
  uppselt boolean not null default false,
  hidden boolean not null default false,
  tilbod boolean not null default false,
  image_bucket text,
  image_folder text,
  legacy_table text,
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_type_check check (type in ('gaming_pc', 'console', 'laptop', 'screen'))
);

create unique index if not exists products_legacy_uidx
  on public.products (legacy_table, legacy_id)
  where legacy_table is not null and legacy_id is not null;

create index if not exists products_group_idx on public.products (group_id);
create index if not exists products_type_idx on public.products (type);
create index if not exists products_hidden_idx on public.products (hidden);

comment on column public.products.specs is 'Type-specific fields (cpu/gpu for PCs, panel specs for screens, …).';
comment on column public.products.image_folder is 'Storage folder; migrated rows keep the old table id so existing images still resolve.';

-- ---------------------------------------------------------------------------
-- product_variants (laptops / anything with SKU options)
-- ---------------------------------------------------------------------------
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  options jsonb not null default '{}'::jsonb,
  price numeric,
  trygging numeric,
  stock_quantity integer,
  legacy_id text,
  created_at timestamptz not null default now()
);

create unique index if not exists product_variants_legacy_uidx
  on public.product_variants (legacy_id)
  where legacy_id is not null;

create index if not exists product_variants_product_idx on public.product_variants (product_id);

-- ---------------------------------------------------------------------------
-- term pricing (1/3/6/9/12 month) — used by Gaming PCs today
-- ---------------------------------------------------------------------------
create table if not exists public.product_term_prices (
  product_id uuid primary key references public.products(id) on delete cascade,
  month_1 text,
  month_3 text,
  month_6 text,
  month_9 text,
  month_12 text
);

-- ---------------------------------------------------------------------------
-- aukahlutir (keyboards, mice, Apple extras — not homepage products)
-- ---------------------------------------------------------------------------
create table if not exists public.aukahlutir (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  name text not null,
  price numeric,
  specs jsonb not null default '{}'::jsonb,
  image_bucket text,
  image_folder text,
  legacy_table text,
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint aukahlutir_type_check check (type in ('keyboard', 'mouse', 'apple_accessory'))
);

create unique index if not exists aukahlutir_legacy_uidx
  on public.aukahlutir (legacy_table, legacy_id)
  where legacy_table is not null and legacy_id is not null;

create table if not exists public.product_aukahlutir (
  product_id uuid not null references public.products(id) on delete cascade,
  aukahlutur_id uuid not null references public.aukahlutir(id) on delete cascade,
  primary key (product_id, aukahlutur_id)
);

-- Screens (and any other product) that can be bundled with a PC/console
create table if not exists public.product_compat (
  product_id uuid not null references public.products(id) on delete cascade,
  compatible_product_id uuid not null references public.products(id) on delete cascade,
  primary key (product_id, compatible_product_id),
  constraint product_compat_no_self check (product_id <> compatible_product_id)
);

-- ---------------------------------------------------------------------------
-- Copy: GamingPC → products
-- ---------------------------------------------------------------------------
insert into public.products (
  group_id, type, name, description, innifalid, price, trygging, specs,
  uppselt, hidden, tilbod, image_bucket, image_folder,
  legacy_table, legacy_id, created_at
)
select
  '11111111-1111-4111-8111-111111111004',
  'gaming_pc',
  g.name,
  null,
  nullif(g.innifalid, ''),
  public.parse_isk(g.verd::text),
  public.parse_isk(g.trygging::text),
  jsonb_strip_nulls(jsonb_build_object(
    'cpu', nullif(g.cpu, ''),
    'gpu', nullif(g.gpu, ''),
    'ram', nullif(g.ram, ''),
    'storage', nullif(g.storage, ''),
    'motherboard', nullif(g.motherboard, ''),
    'powersupply', nullif(g.powersupply, ''),
    'cpucooler', nullif(g.cpucooler, '')
  )),
  public.jsonb_bool(to_jsonb(g), 'uppselt', false),
  public.jsonb_bool(to_jsonb(g), 'falid', false),
  public.jsonb_bool(to_jsonb(g), 'tilbod', false),
  'gamingpcimages',
  g.id::text,
  'GamingPC',
  g.id::text,
  coalesce(g.created_at, now())
from public."GamingPC" g
where not exists (
  select 1 from public.products p
  where p.legacy_table = 'GamingPC' and p.legacy_id = g.id::text
);

-- ---------------------------------------------------------------------------
-- Copy: gamingconsoles → products
-- ---------------------------------------------------------------------------
insert into public.products (
  group_id, type, name, innifalid, price, specs,
  image_bucket, image_folder, legacy_table, legacy_id, created_at
)
select
  '11111111-1111-4111-8111-111111111004',
  'console',
  c.nafn,
  null,
  public.parse_isk(c.verd::text),
  jsonb_strip_nulls(jsonb_build_object(
    'geymsluplass', nullif(c.geymsluplass, ''),
    'tengi', nullif(c.tengi, ''),
    'numberofextracontrollers', nullif(c.numberofextracontrollers::text, ''),
    'verdextracontrollers', nullif(c.verdextracontrollers::text, '')
  )),
  'consoles',
  c.id::text,
  'gamingconsoles',
  c.id::text,
  coalesce(c.inserted_at, now())
from public.gamingconsoles c
where not exists (
  select 1 from public.products p
  where p.legacy_table = 'gamingconsoles' and p.legacy_id = c.id::text
);

-- ---------------------------------------------------------------------------
-- Copy: laptops → products (group by name prefix, same as current homepage)
-- ---------------------------------------------------------------------------
insert into public.products (
  group_id, type, name, description, innifalid, hidden,
  image_bucket, image_folder, legacy_table, legacy_id, created_at, updated_at
)
select
  case
    when lower(trim(l.name)) like 'macbook%' then '11111111-1111-4111-8111-111111111001'::uuid
    when lower(trim(l.name)) like 'ipad%' then '11111111-1111-4111-8111-111111111002'::uuid
    else '11111111-1111-4111-8111-111111111003'::uuid
  end,
  'laptop',
  l.name,
  nullif(l.description, ''),
  nullif(l.innifalid, ''),
  coalesce(l.active, true) is not true,
  'laptopimages',
  l.id::text,
  'laptops',
  l.id::text,
  coalesce(l.created_at, now()),
  coalesce(l.updated_at, now())
from public.laptops l
where not exists (
  select 1 from public.products p
  where p.legacy_table = 'laptops' and p.legacy_id = l.id::text
);

insert into public.product_variants (
  product_id, options, price, trygging, stock_quantity, legacy_id, created_at
)
select
  p.id,
  jsonb_strip_nulls(jsonb_build_object('storage_gb', v.storage_gb)),
  v.price,
  v.trygging,
  v.stock_quantity,
  v.id::text,
  coalesce(v.created_at, now())
from public.laptop_variants v
join public.products p
  on p.legacy_table = 'laptops' and p.legacy_id = v.laptop_id::text
where not exists (
  select 1 from public.product_variants pv where pv.legacy_id = v.id::text
);

-- ---------------------------------------------------------------------------
-- Copy: screens → products
-- ---------------------------------------------------------------------------
insert into public.products (
  group_id, type, name, price, specs, uppselt, hidden,
  image_bucket, image_folder, legacy_table, legacy_id, created_at
)
select
  '11111111-1111-4111-8111-111111111005',
  'screen',
  trim(both ' ' from concat_ws(' ', nullif(s.framleidandi, ''), nullif(s.skjastaerd, ''))),
  public.parse_isk(s.verd::text),
  jsonb_strip_nulls(jsonb_build_object(
    'framleidandi', nullif(s.framleidandi, ''),
    'skjastaerd', nullif(s.skjastaerd, ''),
    'upplausn', nullif(s.upplausn, ''),
    'skjataekni', nullif(s.skjataekni, ''),
    'endurnyjunartidni', nullif(s.endurnyjunartidni, '')
  )),
  public.jsonb_bool(to_jsonb(s), 'uppselt', false),
  public.jsonb_bool(to_jsonb(s), 'falid', false),
  'screens',
  s.id::text,
  'screens',
  s.id::text,
  coalesce(public.jsonb_ts(to_jsonb(s), 'created_at'), now())
from public.screens s
where not exists (
  select 1 from public.products p
  where p.legacy_table = 'screens' and p.legacy_id = s.id::text
);

-- ---------------------------------------------------------------------------
-- Copy: prices → product_term_prices
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.prices') is not null then
    execute $u$
      insert into public.product_term_prices (product_id, month_1, month_3, month_6, month_9, month_12)
      select
        p.id,
        pr."1month",
        pr."3month",
        pr."6month",
        pr."9month",
        pr."12month"
      from public.prices pr
      join public.products p
        on p.legacy_table = 'GamingPC' and p.legacy_id = pr.gamingpc_id::text
      on conflict (product_id) do nothing
    $u$;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Copy: keyboards / mouses / appleaukahlutir → aukahlutir
-- ---------------------------------------------------------------------------
insert into public.aukahlutir (
  type, name, price, specs, image_bucket, image_folder, legacy_table, legacy_id, created_at
)
select
  'keyboard',
  k.nafn,
  public.parse_isk(k.verd::text),
  jsonb_strip_nulls(jsonb_build_object(
    'framleidandi', nullif(k.framleidandi, ''),
    'staerd', nullif(k.staerd, ''),
    'tengimoguleiki', nullif(k.tengimoguleiki, '')
  )),
  'keyboards',
  k.id::text,
  'keyboards',
  k.id::text,
  coalesce(public.jsonb_ts(to_jsonb(k), 'created_at'), now())
from public.keyboards k
where not exists (
  select 1 from public.aukahlutir a
  where a.legacy_table = 'keyboards' and a.legacy_id = k.id::text
);

insert into public.aukahlutir (
  type, name, price, specs, image_bucket, image_folder, legacy_table, legacy_id, created_at
)
select
  'mouse',
  m.nafn,
  public.parse_isk(m.verd::text),
  jsonb_strip_nulls(jsonb_build_object(
    'framleidandi', nullif(m.framleidandi, ''),
    'fjolditakk', nullif(m.fjolditakk, ''),
    'toltakka', nullif(m.toltakka, ''),
    'tengimoguleiki', nullif(m.tengimoguleiki, '')
  )),
  'mouses',
  m.id::text,
  'mouses',
  m.id::text,
  coalesce(public.jsonb_ts(to_jsonb(m), 'created_at'), now())
from public.mouses m
where not exists (
  select 1 from public.aukahlutir a
  where a.legacy_table = 'mouses' and a.legacy_id = m.id::text
);

do $$
begin
  if to_regclass('public.appleaukahlutir') is not null then
    execute $u$
      insert into public.aukahlutir (
        type, name, price, specs, legacy_table, legacy_id
      )
      select
        'apple_accessory',
        ap.nafn,
        public.parse_isk(ap.verd::text),
        '{}'::jsonb,
        'appleaukahlutir',
        ap.id::text
      from public.appleaukahlutir ap
      where not exists (
        select 1 from public.aukahlutir a
        where a.legacy_table = 'appleaukahlutir' and a.legacy_id = ap.id::text
      )
    $u$;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Junction copy (skip source tables that were never created)
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.screen_gamingpcs') is not null then
    insert into public.product_compat (product_id, compatible_product_id)
    select pc.id, scr.id
    from public.screen_gamingpcs j
    join public.products pc on pc.legacy_table = 'GamingPC' and pc.legacy_id = j.gamingpc_id::text
    join public.products scr on scr.legacy_table = 'screens' and scr.legacy_id = j.screen_id::text
    on conflict do nothing;
  end if;

  if to_regclass('public.screen_gamingconsoles') is not null then
    insert into public.product_compat (product_id, compatible_product_id)
    select cons.id, scr.id
    from public.screen_gamingconsoles j
    join public.products cons on cons.legacy_table = 'gamingconsoles' and cons.legacy_id = j.gamingconsole_id::text
    join public.products scr on scr.legacy_table = 'screens' and scr.legacy_id = j.screen_id::text
    on conflict do nothing;
  end if;

  if to_regclass('public.keyboard_gamingpcs') is not null then
    insert into public.product_aukahlutir (product_id, aukahlutur_id)
    select p.id, a.id
    from public.keyboard_gamingpcs j
    join public.products p on p.legacy_table = 'GamingPC' and p.legacy_id = j.gamingpc_id::text
    join public.aukahlutir a on a.legacy_table = 'keyboards' and a.legacy_id = j.keyboard_id::text
    on conflict do nothing;
  end if;

  if to_regclass('public.keyboard_gamingconsoles') is not null then
    insert into public.product_aukahlutir (product_id, aukahlutur_id)
    select p.id, a.id
    from public.keyboard_gamingconsoles j
    join public.products p on p.legacy_table = 'gamingconsoles' and p.legacy_id = j.console_id::text
    join public.aukahlutir a on a.legacy_table = 'keyboards' and a.legacy_id = j.keyboard_id::text
    on conflict do nothing;
  end if;

  if to_regclass('public.mouse_gamingpcs') is not null then
    insert into public.product_aukahlutir (product_id, aukahlutur_id)
    select p.id, a.id
    from public.mouse_gamingpcs j
    join public.products p on p.legacy_table = 'GamingPC' and p.legacy_id = j.gamingpc_id::text
    join public.aukahlutir a on a.legacy_table = 'mouses' and a.legacy_id = j.mouse_id::text
    on conflict do nothing;
  end if;

  if to_regclass('public.mouse_gamingconsoles') is not null then
    insert into public.product_aukahlutir (product_id, aukahlutur_id)
    select p.id, a.id
    from public.mouse_gamingconsoles j
    join public.products p on p.legacy_table = 'gamingconsoles' and p.legacy_id = j.console_id::text
    join public.aukahlutir a on a.legacy_table = 'mouses' and a.legacy_id = j.mouse_id::text
    on conflict do nothing;
  end if;

  if to_regclass('public.appleaukahlutir') is not null then
    insert into public.product_aukahlutir (product_id, aukahlutur_id)
    select p.id, a.id
    from public.appleaukahlutir ap
    join public.products p on p.legacy_table = 'laptops' and p.legacy_id = ap.laptop_uuid::text
    join public.aukahlutir a on a.legacy_table = 'appleaukahlutir' and a.legacy_id = ap.id::text
    where ap.laptop_uuid is not null
    on conflict do nothing;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Orders / preorders: add new FKs and backfill (keep old columns)
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists product_id uuid references public.products(id),
  add column if not exists variant_id uuid references public.product_variants(id),
  add column if not exists screen_product_id uuid references public.products(id);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'gamingpc_uuid'
  ) then
    execute $u$
      update public.orders o
      set product_id = p.id
      from public.products p
      where o.product_id is null
        and o.gamingpc_uuid is not null
        and p.legacy_table = 'GamingPC'
        and p.legacy_id = o.gamingpc_uuid::text
    $u$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'gamingconsole_uuid'
  ) then
    execute $u$
      update public.orders o
      set product_id = p.id
      from public.products p
      where o.product_id is null
        and o.gamingconsole_uuid is not null
        and p.legacy_table = 'gamingconsoles'
        and p.legacy_id = o.gamingconsole_uuid::text
    $u$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'screen_uuid'
  ) then
    execute $u$
      update public.orders o
      set product_id = p.id
      from public.products p
      where o.product_id is null
        and o.screen_uuid is not null
        and p.legacy_table = 'screens'
        and p.legacy_id = o.screen_uuid::text
    $u$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'laptop_variant_uuid'
  ) then
    execute $u$
      update public.orders o
      set product_id = pv.product_id,
          variant_id = pv.id
      from public.product_variants pv
      where o.laptop_variant_uuid is not null
        and pv.legacy_id = o.laptop_variant_uuid::text
        and (o.product_id is null or o.variant_id is null)
    $u$;
  end if;
end $$;

do $$
begin
  if to_regclass('public.preorders') is not null then
    execute 'alter table public.preorders add column if not exists product_id uuid references public.products(id)';

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'preorders' and column_name = 'gamingpc_uuid'
    ) then
      execute $u$
        update public.preorders po
        set product_id = p.id
        from public.products p
        where po.product_id is null
          and po.gamingpc_uuid is not null
          and p.legacy_table = 'GamingPC'
          and p.legacy_id = po.gamingpc_uuid::text
      $u$;
    end if;

    execute 'create index if not exists preorders_product_id_idx on public.preorders (product_id)';
  end if;
end $$;

create index if not exists orders_product_id_idx on public.orders (product_id);

-- ---------------------------------------------------------------------------
-- RLS: public can read visible catalog; authenticated can write (admin UI)
-- ---------------------------------------------------------------------------
alter table public.product_groups enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_term_prices enable row level security;
alter table public.aukahlutir enable row level security;
alter table public.product_aukahlutir enable row level security;
alter table public.product_compat enable row level security;

do $$
begin
  -- product_groups
  if not exists (select 1 from pg_policies where tablename = 'product_groups' and policyname = 'Public read product_groups') then
    create policy "Public read product_groups" on public.product_groups for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'product_groups' and policyname = 'Authenticated write product_groups') then
    create policy "Authenticated write product_groups" on public.product_groups for all to authenticated using (true) with check (true);
  end if;

  -- products: anon sees non-hidden; authenticated sees all (admin)
  if not exists (select 1 from pg_policies where tablename = 'products' and policyname = 'Public read visible products') then
    create policy "Public read visible products" on public.products for select to anon using (hidden = false);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'products' and policyname = 'Authenticated read products') then
    create policy "Authenticated read products" on public.products for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'products' and policyname = 'Authenticated write products') then
    create policy "Authenticated write products" on public.products for all to authenticated using (true) with check (true);
  end if;

  -- variants
  if not exists (select 1 from pg_policies where tablename = 'product_variants' and policyname = 'Public read product_variants') then
    create policy "Public read product_variants" on public.product_variants for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'product_variants' and policyname = 'Authenticated write product_variants') then
    create policy "Authenticated write product_variants" on public.product_variants for all to authenticated using (true) with check (true);
  end if;

  -- term prices
  if not exists (select 1 from pg_policies where tablename = 'product_term_prices' and policyname = 'Public read product_term_prices') then
    create policy "Public read product_term_prices" on public.product_term_prices for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'product_term_prices' and policyname = 'Authenticated write product_term_prices') then
    create policy "Authenticated write product_term_prices" on public.product_term_prices for all to authenticated using (true) with check (true);
  end if;

  -- aukahlutir
  if not exists (select 1 from pg_policies where tablename = 'aukahlutir' and policyname = 'Public read aukahlutir') then
    create policy "Public read aukahlutir" on public.aukahlutir for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'aukahlutir' and policyname = 'Authenticated write aukahlutir') then
    create policy "Authenticated write aukahlutir" on public.aukahlutir for all to authenticated using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'product_aukahlutir' and policyname = 'Public read product_aukahlutir') then
    create policy "Public read product_aukahlutir" on public.product_aukahlutir for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'product_aukahlutir' and policyname = 'Authenticated write product_aukahlutir') then
    create policy "Authenticated write product_aukahlutir" on public.product_aukahlutir for all to authenticated using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'product_compat' and policyname = 'Public read product_compat') then
    create policy "Public read product_compat" on public.product_compat for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'product_compat' and policyname = 'Authenticated write product_compat') then
    create policy "Authenticated write product_compat" on public.product_compat for all to authenticated using (true) with check (true);
  end if;
end $$;

grant select on public.product_groups, public.products, public.product_variants,
  public.product_term_prices, public.aukahlutir, public.product_aukahlutir, public.product_compat
  to anon, authenticated;

grant insert, update, delete on public.product_groups, public.products, public.product_variants,
  public.product_term_prices, public.aukahlutir, public.product_aukahlutir, public.product_compat
  to authenticated;
