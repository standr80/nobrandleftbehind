-- Gallery ordering, event dates, and a featured gallery.
--
-- Three things the gallery index could not express:
--   1. order — galleries came out newest-published first, which is arbitrary
--      once several are added in one sitting
--   2. when the event actually happened, as opposed to when it was uploaded
--   3. which gallery a consumer site should lead with
--
-- All three are nullable / default false, so existing galleries are unchanged.

alter table public.blog_posts
  add column if not exists gallery_display_order int;

comment on column public.blog_posts.gallery_display_order is
  'Gallery posts only: manual sort position, ascending. NULL sorts last, falling back to published_at desc.';

alter table public.blog_posts
  add column if not exists gallery_event_date date;

comment on column public.blog_posts.gallery_event_date is
  'Gallery posts only: when the event happened, as distinct from when it was published. Consumers show this instead of published_at, and show nothing when it is null.';

alter table public.blog_posts
  add column if not exists gallery_featured boolean not null default false;

comment on column public.blog_posts.gallery_featured is
  'Gallery posts only: the gallery a consumer site should lead with (e.g. a home page hero). At most one per tenant — setting it clears the others.';

-- Ordering the public index, and finding the featured gallery, are both hot
-- reads on the Content API.
create index if not exists blog_posts_gallery_order_idx
  on public.blog_posts (tenant_id, gallery_display_order)
  where content_type = 'gallery';

create index if not exists blog_posts_gallery_featured_idx
  on public.blog_posts (tenant_id)
  where gallery_featured;
