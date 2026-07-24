-- ============================================================
-- Migration 038: Bailey image galleries
--
-- Bailey is the image/gallery agent (Clem = writing, Scout = research).
-- A gallery IS a page: another content type on blog_posts, published through
-- the existing Shopify adapter into a dedicated `galleries` blog. This
-- migration adds the 'gallery' content type, the ordered image array, and
-- the publish-time consent attestation.
--
-- The `gallery-images` Storage bucket (public read, writes only via signed
-- upload URLs issued by an authenticated route) is created lazily by the
-- upload-url route with a 10MB file-size limit and an image mime allowlist —
-- same pattern as the hero-images bucket. No SQL needed for it.
--
-- Safe/idempotent: existing rows are untouched; the constraint swap
-- re-permits the existing 'blog' and 'faq' values.
-- ============================================================

-- Allow 'gallery' as a content type.
alter table public.blog_posts
  drop constraint if exists blog_posts_content_type_check;
alter table public.blog_posts
  add constraint blog_posts_content_type_check
    check (content_type in ('blog', 'faq', 'gallery'));

-- Ordered image array for gallery posts; null for other content types.
-- [{ id, storage_path, master_path, url, thumb_url, width, height, alt,
--    caption, filename_slug, order, source, source_ref, status, error }]
-- Per-image status: importing | uploaded | processed | enriched | ready | failed
alter table public.blog_posts
  add column if not exists gallery_images jsonb;

-- Optional user-supplied event context (venue, occasion, location) captured
-- at gallery creation. The single biggest quality lever for vision
-- enrichment prompts and Clem's page copy.
alter table public.blog_posts
  add column if not exists gallery_context text;

-- Publish-gate consent attestation ("I have the right to publish these
-- images, including any identifiable people in them"). Required before a
-- gallery can publish; stored for the record.
alter table public.blog_posts
  add column if not exists consent_attested_by text;   -- Clerk user id
alter table public.blog_posts
  add column if not exists consent_attested_at timestamptz;

comment on column public.blog_posts.gallery_images is
  'Bailey: ordered image objects for content_type=gallery. Statuses: importing|uploaded|processed|enriched|ready|failed.';
comment on column public.blog_posts.consent_attested_by is
  'Bailey: Clerk user id of whoever attested publish consent for gallery images.';
