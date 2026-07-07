-- Shopify Dev Dashboard auth (client credentials grant).
--
-- Since Jan 2026 new custom apps can only be created in the Shopify Dev
-- Dashboard, which authenticates via the OAuth client credentials grant rather
-- than a static admin token. Store the app's Client ID + Secret; NBLB exchanges
-- them for a 24h access token at publish time. The static shopify_access_token
-- (migration 032) stays as a fallback for legacy admin-created custom apps.

alter table tenants
  add column if not exists shopify_client_id     text,
  add column if not exists shopify_client_secret text;

comment on column tenants.shopify_client_id is
  'Dev Dashboard app Client ID (client credentials grant). Preferred auth path.';
comment on column tenants.shopify_client_secret is
  'Dev Dashboard app Client Secret. Store-scoped secret — never expose client-side. Exchanged for a 24h access token per publish.';
