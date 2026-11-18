-- Weekly rental price. Null means the product is only offered at the monthly price.
alter table public.products
  add column if not exists priceweek numeric;

comment on column public.products.priceweek is
  'Weekly rental price in ISK. Shown as kr/viku when set.';
