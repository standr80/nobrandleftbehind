-- ============================================================
-- Migration 028: per-tenant Vercel Deploy Hook
--
-- For tenants whose blog is a prerendered (static) site pulling from the
-- Content API (e.g. fun4guests, megacheques on Astro/Vercel), a published
-- post only appears after the site rebuilds. Storing the site's Vercel
-- Deploy Hook URL here lets Clem ping it on publish so the site rebuilds
-- automatically. NULL = no auto-rebuild (e.g. git or embed-only tenants).
-- ============================================================

alter table public.tenants
  add column if not exists deploy_hook_url text;
