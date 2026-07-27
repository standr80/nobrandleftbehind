-- ============================================================
-- Migration 040: dedicated Shopify blog for Bailey galleries
--
-- Galleries (content_type='gallery') publish as articles into a SEPARATE
-- Shopify blog (e.g. /blogs/galleries) — exactly the FAQ-blog pattern from
-- migration 034. Shopify auto-lists them at /blogs/<handle> (free gallery
-- index page, one nav link, no orphan risk).
-- ============================================================

alter table tenants
  add column if not exists shopify_gallery_blog_id text;

comment on column tenants.shopify_gallery_blog_id is
  'Target Shopify Blog id for gallery posts (numeric or gid://shopify/Blog/NNN), e.g. a blog with handle "galleries" → /blogs/galleries. Gallery publish errors until set.';
