-- Store the full page inventory per competitor snapshot so "new pages" can be
-- computed by diffing against the previous crawl's complete URL set. Without
-- this, the diff had nothing valid to compare against and reported every crawled
-- page (up to the 100 map cap) as new every run.

alter table scout_competitor_snapshots
  add column if not exists page_urls jsonb default '[]';
