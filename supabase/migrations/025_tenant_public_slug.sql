-- ============================================================
-- Migration 025: tenant public_slug + content_api_key
--
-- Gives each tenant a stable, explicit public identifier for the
-- Content API (replacing the fragile ilike/domain-substring lookup),
-- and an optional per-tenant read API key for higher-trust consumers.
-- ============================================================

-- Stable public slug used in Content API URLs: /content/v1/tenants/{public_slug}/...
alter table public.tenants
  add column if not exists public_slug text;

-- Optional bearer token for higher-trust consumers (e.g. the WordPress plugin).
-- NULL = tenant uses the public, unauthenticated published feed only.
alter table public.tenants
  add column if not exists content_api_key text;

-- Backfill existing tenants from their domain:
--   "www.designsonprint.com" -> "designsonprint"
-- Mirrors domainToSlug() so existing /api/feed consumers keep resolving.
update public.tenants
set public_slug = lower(split_part(regexp_replace(domain, '^(https?://)?(www\.)?', ''), '.', 1))
where public_slug is null;

-- Enforce uniqueness once backfilled. If two existing tenants collide here,
-- the index creation fails — resolve by setting a distinct public_slug manually
-- before re-running.
create unique index if not exists idx_tenants_public_slug
  on public.tenants (public_slug);

-- Note: not adding NOT NULL yet so onboarding a tenant without an explicit
-- slug doesn't hard-fail. Add `alter table tenants alter column public_slug
-- set not null;` once the onboarding UI always sets it.
