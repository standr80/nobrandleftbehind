-- Brand terms for classifying rank-tracked keywords as branded vs non-branded.
-- Empty by default; the app also falls back to the tenant name when unset.

alter table scout_config
  add column if not exists brand_terms text[] default '{}';
