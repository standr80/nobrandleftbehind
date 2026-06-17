-- ============================================================
-- Migration 029: per-tenant internal link map
--
-- A curated list of the host site's key pages that Clem may link to from
-- within blog articles (internal linking for SEO + conversions). Clem links
-- ONLY to pages in this list (so it never invents/404s a URL), always
-- including any marked must_link.
--
-- Shape: [{ "url": "...", "label": "...", "description": "...", "must_link": false }]
-- ============================================================

alter table public.tenants
  add column if not exists internal_links jsonb default '[]';
