-- ============================================================
-- Migration 042: Google Search Console page stats (Pam stage 4)
--
-- Weekly per-URL rollups pulled from the GSC Search Analytics API via a
-- shared service account (env GSC_SERVICE_ACCOUNT_KEY; the SA email is
-- added as a user to each brand's Search Console property). The property
-- each tenant maps to lives in scout_config.gsc_property_id (stub column
-- from migration 010, now in use); gsc_connected flips true on first
-- successful sync.
--
-- Pam's decay signal compares the last 4 full weeks vs the previous 4 per
-- URL to spot content losing clicks/position — the single best refresh
-- trigger available.
-- ============================================================

create table if not exists gsc_page_stats (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  url text not null,
  week_start date not null,          -- ISO week, Monday
  clicks integer not null default 0,
  impressions integer not null default 0,
  ctr numeric,                       -- clicks / impressions
  position numeric,                  -- impression-weighted average position
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (tenant_id, url, week_start)
);

create index if not exists gsc_page_stats_tenant_week_idx
  on gsc_page_stats (tenant_id, week_start desc);

alter table gsc_page_stats enable row level security;

comment on table gsc_page_stats is
  'Weekly GSC search-analytics rollups per URL. Synced by /api/cron/gsc; consumed by Pam''s decay signal.';
