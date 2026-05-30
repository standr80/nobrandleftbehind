-- Per-feature toggles and configurable alert threshold for Scout.
-- Lets each tenant choose which pipelines run and how sensitive rank alerts are.

alter table scout_config
  add column if not exists track_competitors boolean default true,
  add column if not exists track_keywords boolean default true,
  add column if not exists track_rankings boolean default true,
  -- Minimum position change (places) that triggers a rank-movement alert.
  add column if not exists rank_alert_threshold integer default 5;
