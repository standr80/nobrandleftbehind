-- Multi-location rank tracking.
-- Tag each rank-history row with the search location it was measured in, and
-- let a tenant track rankings in several markets at once.

-- 1. Tag historical rows. Existing data was all UK (2826).
alter table scout_rank_history
  add column if not exists location_code integer not null default 2826;

-- 2. Uniqueness must now include location so UK and US positions for the same
--    keyword/date can coexist. Replace the old 3-column key.
alter table scout_rank_history
  drop constraint if exists scout_rank_history_tenant_id_keyword_snapshot_date_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'scout_rank_history_tenant_kw_date_loc_key'
  ) then
    alter table scout_rank_history
      add constraint scout_rank_history_tenant_kw_date_loc_key
      unique (tenant_id, keyword, snapshot_date, location_code);
  end if;
end $$;

create index if not exists idx_rank_history_tenant_loc_date
  on scout_rank_history(tenant_id, location_code, snapshot_date desc);

-- 3. Per-tenant list of rank-tracking locations. Defaults to UK to preserve
--    current behaviour. The primary scout_config.location_code (used for keyword
--    and competitor research) is always included by the pipeline.
alter table scout_config
  add column if not exists rank_location_codes integer[] default '{2826}';
