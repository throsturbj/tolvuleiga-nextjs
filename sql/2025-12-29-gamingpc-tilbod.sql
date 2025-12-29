-- Add 'tilbod' (offer) flag to GamingPC
-- Marks products that are part of the New Year offer campaign

alter table public."GamingPC"
  add column if not exists tilbod boolean not null default false;

comment on column public."GamingPC".tilbod is 'Nýárstilboð flag; when true, treat all monthly prices as the 12-month price for the campaign.';


