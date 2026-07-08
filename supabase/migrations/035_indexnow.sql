-- IndexNow support.
--
-- On publish, Clem pings IndexNow so Bing (and therefore ChatGPT search) sees
-- new/updated URLs within hours instead of on the next crawl. Per-tenant because
-- the key belongs to the store's domain.
--
-- Shopify can't host the key file at the site root, so upload it via
-- Settings → Files and store that CDN URL as indexnow_key_location.

alter table tenants
  add column if not exists indexnow_key          text,
  add column if not exists indexnow_key_location text;

comment on column tenants.indexnow_key is
  'IndexNow API key (any GUID-like string). Also the name of the key .txt file hosted on the domain.';
comment on column tenants.indexnow_key_location is
  'Public URL of the key file. On Shopify, the Settings → Files CDN URL of {key}.txt.';
