-- Device dimension for rank tracking (desktop / mobile).
-- Existing rows are desktop. Uniqueness must include device so the same
-- keyword/date/location can hold separate desktop and mobile positions.

alter table scout_rank_history
  add column if not exists device text not null default 'desktop';

alter table scout_rank_history
  drop constraint if exists scout_rank_history_tenant_kw_date_loc_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'scout_rank_history_tenant_kw_date_loc_dev_key'
  ) then
    alter table scout_rank_history
      add constraint scout_rank_history_tenant_kw_date_loc_dev_key
      unique (tenant_id, keyword, snapshot_date, location_code, device);
  end if;
end $$;

-- Per-tenant devices to track. Defaults to desktop only.
alter table scout_config
  add column if not exists rank_devices text[] default '{desktop}';
