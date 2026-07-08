-- Topical clusters (hub-and-spoke internal linking).
--
-- A cluster is a topic with a commercial "money" page at its centre. Clem
-- classifies each new post into a cluster at generation time; the Shopify
-- adapter then pins a link to the cluster's money page in the post's
-- Related-reading block, funnelling authority to the commercial page.
--
-- tenants.content_clusters shape (jsonb array):
--   [{ "name": "Band merch", "money_url": "https://.../merch", "money_label": "Custom band merch", "keywords": ["merch","t-shirts",...] }]

alter table tenants
  add column if not exists content_clusters jsonb;

alter table blog_posts
  add column if not exists cluster_id text;

comment on column tenants.content_clusters is
  'Topical clusters for hub-and-spoke linking: [{name, money_url, money_label, keywords[]}]. Cluster name is the match key stored on blog_posts.cluster_id.';
comment on column blog_posts.cluster_id is
  'Name of the content cluster this post belongs to (matches a tenants.content_clusters[].name). Set by Clem at generation.';
