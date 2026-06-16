-- ============================================================
-- Migration 026: blog_posts soft-delete (deleted_at)
--
-- Enables the Content API to emit DELETE tombstones in ?since= sync
-- responses. Consumers (WordPress plugin, embed) can then mirror
-- unpublishes/removals instead of leaking stale posts.
--
-- IMPORTANT: application code must stop issuing hard DELETEs on
-- blog_posts and instead set deleted_at = now(). A hard-deleted row
-- disappears entirely and cannot produce a tombstone.
-- ============================================================

alter table public.blog_posts
  add column if not exists deleted_at timestamptz;

-- The Content API sync query orders by updated_at and filters on it for
-- ?since=; this index keeps both the incremental pull and the tombstone
-- scan cheap.
create index if not exists idx_blog_posts_tenant_updated_at
  on public.blog_posts (tenant_id, updated_at);

-- Partial index for the common "live published posts" listing.
create index if not exists idx_blog_posts_live
  on public.blog_posts (tenant_id, published_at desc)
  where status = 'published' and deleted_at is null;
