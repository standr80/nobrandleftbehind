-- Gallery caption display.
--
-- Captions were previously all-or-nothing per image: to stop them appearing on
-- the published page you had to delete the text, which threw away wording the
-- vision pass had paid to generate and had to be repeated per image, per
-- gallery. Display is now a setting, so the text is kept either way and can
-- still feed alt text, structured data and search.
--
-- Both default true — existing galleries keep showing captions exactly as now.

alter table public.blog_posts
  add column if not exists gallery_show_captions boolean not null default true;

comment on column public.blog_posts.gallery_show_captions is
  'Gallery posts only: render captions under each image on the published page. Caption text is retained either way.';

-- Per-tenant default, applied when a gallery is created. A site that never
-- wants captions sets it once instead of switching every new gallery.
alter table public.tenants
  add column if not exists gallery_captions_default boolean not null default true;

comment on column public.tenants.gallery_captions_default is
  'Default value for blog_posts.gallery_show_captions on newly created galleries.';
