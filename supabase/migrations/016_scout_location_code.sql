-- Per-tenant search location for Scout's DataForSEO calls.
-- Defaults to 2826 (United Kingdom / google.co.uk), preserving current behaviour.
-- See https://docs.dataforseo.com/v3/serp/google/locations/ for codes.

alter table scout_config
  add column if not exists location_code integer default 2826;
