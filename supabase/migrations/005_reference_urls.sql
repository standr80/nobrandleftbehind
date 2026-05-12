-- Add reference URLs to tenants (up to 3 competitor/reference sites for crawling)
alter table public.tenants
  add column if not exists reference_urls text[] not null default '{}';

-- Add reference crawl summaries to the crawl cache (one row per tenant)
alter table public.site_crawl_cache
  add column if not exists reference_summaries jsonb not null default '[]'::jsonb;
