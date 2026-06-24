-- ============================================================
-- Migration 030: content types (blog vs faq) + post provenance
--
-- Until now blog_posts only held blog articles. This adds a content_type so
-- the same lifecycle (draft → review → schedule → publish) can also produce
-- FAQ pages, plus structured Q&A for FAQPage schema, and provenance fields
-- used by the content-refresh agent.
--
-- Safe/idempotent: everything defaults so existing rows become content_type
-- 'blog' with no behaviour change.
-- ============================================================

alter table public.blog_posts
  add column if not exists content_type text not null default 'blog'
    check (content_type in ('blog', 'faq'));

-- Structured Q&A for FAQ posts; null for blog posts. [{ "q": "...", "a": "..." }]
alter table public.blog_posts
  add column if not exists faq_items jsonb;

-- Why this post exists. 'manual' | 'clem' | 'scout' | 'refresh'
alter table public.blog_posts
  add column if not exists origin text default 'manual';

-- When the post was last materially refreshed (content-refresh agent).
alter table public.blog_posts
  add column if not exists last_refreshed_at timestamptz;

-- A suggestion now knows what kind of content it will become.
alter table public.suggestions
  add column if not exists content_type text not null default 'blog'
    check (content_type in ('blog', 'faq'));
