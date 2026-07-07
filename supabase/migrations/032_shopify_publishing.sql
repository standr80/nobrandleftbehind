-- Shopify publishing support for Clem.
-- Adds per-tenant Shopify Admin API config and per-post article references so
-- Clem can publish blog posts directly into a Shopify store's native blog via
-- the GraphQL Admin API (articleCreate / articleUpdate).

-- ── Tenant config ───────────────────────────────────────────────────────────
-- NOTE: auth columns (client_id/secret for the Dev Dashboard client-credentials
-- grant) were added later in migration 033. shopify_access_token here is the
-- static-token path for legacy admin-created custom apps.
alter table tenants
  add column if not exists shopify_shop_domain  text,
  add column if not exists shopify_access_token text,
  add column if not exists shopify_blog_id      text,
  add column if not exists shopify_api_version  text,
  add column if not exists shopify_store_url    text;

comment on column tenants.shopify_shop_domain is
  'Shopify admin domain used for API calls, e.g. your-store.myshopify.com';
comment on column tenants.shopify_access_token is
  'Static Admin API token for legacy admin-created custom apps (write_content scope). Prefer the Dev Dashboard client_id/secret in migration 033. Never expose client-side.';
comment on column tenants.shopify_blog_id is
  'Target Blog id new articles are created in (numeric or gid://shopify/Blog/NNN).';
comment on column tenants.shopify_api_version is
  'Optional Admin API version override, e.g. 2025-10. Falls back to a default in code.';
comment on column tenants.shopify_store_url is
  'Optional public storefront base URL for building article links, e.g. https://www.putterfingers.com. Defaults to https://{shopify_shop_domain}.';

-- ── Per-post article references ─────────────────────────────────────────────
alter table blog_posts
  add column if not exists shopify_article_id  text,
  add column if not exists shopify_article_url text;

comment on column blog_posts.shopify_article_id is
  'gid://shopify/Article/NNN returned by articleCreate. Presence means the post has already been pushed to Shopify (re-publish updates it).';
comment on column blog_posts.shopify_article_url is
  'Public URL of the published Shopify article.';
