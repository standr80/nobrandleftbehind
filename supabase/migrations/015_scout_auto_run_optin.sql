-- Make the weekly Scout cron opt-in per tenant to control API spend.
-- Defaults to false: no tenant runs automatically until explicitly enabled.
-- Manual runs (/api/scout/run) are unaffected by this flag.

alter table scout_config
  add column if not exists auto_run_enabled boolean default false;
