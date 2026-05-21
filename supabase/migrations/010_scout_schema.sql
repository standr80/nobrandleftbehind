-- ============================================================
-- Scout — Market Intelligence Agent Schema
-- nobrandleftbehind.com
-- Migration 010
-- ============================================================

-- ============================================================
-- Extend suggestions table with Scout source tracking
-- ============================================================
alter table suggestions
  add column if not exists source text default 'manual',
  add column if not exists source_type text;

-- ============================================================
-- Scout config per tenant
-- ============================================================
create table if not exists scout_config (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade unique not null,
  enabled boolean default true,
  briefing_day text default 'monday',
  briefing_time text default '07:00',
  competitor_urls text[] default '{}',
  dataforseo_enabled boolean default true,
  -- GSC/GA4 stubs — unpopulated in V1, reserved for V2
  gsc_connected boolean default false,
  ga4_connected boolean default false,
  gsc_property_id text,
  ga4_property_id text,
  gsc_access_token_enc text,
  gsc_refresh_token_enc text,
  ga4_access_token_enc text,
  ga4_refresh_token_enc text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table scout_config enable row level security;

-- ============================================================
-- Weekly briefings
-- ============================================================
create table if not exists scout_briefings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  week_starting date not null,
  status text default 'generating',
  briefing_html text,
  briefing_json jsonb,
  urgent_count integer default 0,
  watch_count integer default 0,
  wins_count integer default 0,
  clem_suggestions_added integer default 0,
  email_sent_at timestamptz,
  created_at timestamptz default now()
);

alter table scout_briefings enable row level security;

-- ============================================================
-- Own site snapshots — stub only in V1
-- (metric columns added in V2 when Pipeline 1 is built)
-- ============================================================
create table if not exists scout_site_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  snapshot_date date not null,
  created_at timestamptz default now()
);

alter table scout_site_snapshots enable row level security;

-- ============================================================
-- Competitor snapshots
-- ============================================================
create table if not exists scout_competitor_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  competitor_url text not null,
  snapshot_date date not null,
  page_count integer,
  new_pages jsonb,
  removed_pages jsonb,
  changed_pages jsonb,
  new_blog_posts jsonb,
  pricing_page_content text,
  pricing_changed boolean default false,
  pricing_change_summary text,
  ranking_keywords jsonb,
  keyword_gaps jsonb,
  new_backlinks jsonb,
  tech_stack jsonb,
  raw_crawl_hash text,
  created_at timestamptz default now()
);

alter table scout_competitor_snapshots enable row level security;

-- ============================================================
-- Keyword opportunity tracking
-- ============================================================
create table if not exists scout_keyword_opportunities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  keyword text not null,
  search_volume integer,
  keyword_difficulty integer,
  opportunity_type text,
  competitor_ranking_url text,
  seasonal_peak_month integer,
  weeks_until_peak integer,
  status text default 'pending',
  clem_suggestion_id uuid references suggestions(id),
  discovered_at timestamptz default now(),
  created_at timestamptz default now()
);

alter table scout_keyword_opportunities enable row level security;

-- ============================================================
-- Alerts (urgent items between weekly briefings)
-- ============================================================
create table if not exists scout_alerts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  alert_type text not null,
  severity text default 'watch',
  title text not null,
  detail text,
  data jsonb,
  actioned boolean default false,
  actioned_at timestamptz,
  briefing_id uuid references scout_briefings(id),
  created_at timestamptz default now()
);

alter table scout_alerts enable row level security;

-- ============================================================
-- PAA cache (avoid redundant DataForSEO calls)
-- ============================================================
create table if not exists scout_paa_cache (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  seed_keyword text not null,
  questions jsonb,
  fetched_at timestamptz default now(),
  expires_at timestamptz
);

alter table scout_paa_cache enable row level security;
