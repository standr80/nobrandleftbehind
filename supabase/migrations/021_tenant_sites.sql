-- ============================================================
-- Migration 021: tenant_sites — unified competitor / reference sites
--
-- Replaces the two parallel stores:
--   • tenants.reference_urls        (Clem settings, max 3 in UI)
--   • scout_config.competitor_urls  (Scout additions, max 5 total in UI)
--
-- One row per site, with role flags. A site can be both a
-- competitor (monitored by Scout) and a reference (crawled by
-- Clem for content inspiration).
--
-- Per-workspace limits (superadmin-set, billing lever):
--   • tenants.max_competitor_sites (default 3)
--   • tenants.max_reference_sites  (default 3)
-- Enforced server-side in /api/sites — no hard caps in code.
--
-- The old columns are kept for now (read path is switched off in
-- app code; safe to drop in a later migration once verified).
-- ============================================================

create table if not exists tenant_sites (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  -- Normalised: lowercase, no scheme, no trailing slash (e.g. "competitor.com/blog")
  url           text not null,
  is_competitor boolean not null default true,
  is_reference  boolean not null default false,
  label         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (tenant_id, url),
  check (is_competitor or is_reference)
);

create index if not exists idx_tenant_sites_tenant on tenant_sites(tenant_id);

alter table tenant_sites enable row level security;

create policy "members_can_read_own_tenant_sites"
  on tenant_sites for select
  using (
    tenant_id in (
      select tenant_id from tenant_members
      where clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

grant select on tenant_sites to authenticated;

-- ── Per-workspace site limits ─────────────────────────────────────────────────

alter table public.tenants
  add column if not exists max_competitor_sites integer not null default 3
    check (max_competitor_sites >= 0),
  add column if not exists max_reference_sites integer not null default 3
    check (max_reference_sites >= 0);

-- ── Backfill ──────────────────────────────────────────────────────────────────
-- Helper expression: strip scheme + www-preserving host/path, drop trailing
-- slash, lowercase. (reference_urls were stored bare, competitor_urls with
-- https:// — normalise both so duplicates collapse onto one row.)

-- 1. Clem reference_urls → reference AND competitor (preserves the previous
--    merged behaviour where Scout also monitored them).
insert into tenant_sites (tenant_id, url, is_competitor, is_reference)
select
  t.id,
  lower(regexp_replace(regexp_replace(u, '^https?://', ''), '/+$', '')),
  true,
  true
from tenants t, unnest(t.reference_urls) as u
where u is not null and btrim(u) <> ''
on conflict (tenant_id, url) do update
  set is_reference = true, is_competitor = true, updated_at = now();

-- 2. Scout competitor_urls → competitor only.
insert into tenant_sites (tenant_id, url, is_competitor, is_reference)
select
  sc.tenant_id,
  lower(regexp_replace(regexp_replace(u, '^https?://', ''), '/+$', '')),
  true,
  false
from scout_config sc, unnest(sc.competitor_urls) as u
where u is not null and btrim(u) <> ''
on conflict (tenant_id, url) do update
  set is_competitor = true, updated_at = now();

-- 3. Grandfather any workspace already over the default limits so existing
--    sites keep working — raise the limit to the current count.
update tenants t
set max_competitor_sites = greatest(t.max_competitor_sites, c.cnt)
from (
  select tenant_id, count(*)::int as cnt
  from tenant_sites where is_competitor group by tenant_id
) c
where c.tenant_id = t.id and c.cnt > t.max_competitor_sites;

update tenants t
set max_reference_sites = greatest(t.max_reference_sites, c.cnt)
from (
  select tenant_id, count(*)::int as cnt
  from tenant_sites where is_reference group by tenant_id
) c
where c.tenant_id = t.id and c.cnt > t.max_reference_sites;
