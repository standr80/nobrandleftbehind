-- ============================================================
-- Migration 039: atomic per-image patch for Bailey galleries
--
-- The processing pipeline runs 2-3 images concurrently (client-driven).
-- Each step updates ONE element of blog_posts.gallery_images. A JS
-- read-modify-write of the whole array would let concurrent updates clobber
-- each other, so the merge happens atomically in Postgres instead: find the
-- element by id, merge the patch into it (jsonb ||), leave siblings alone.
--
-- Called via service-role RPC from the process/enrich/reconcile routes
-- (tenant checks happen in the route before calling).
-- ============================================================

create or replace function public.bailey_patch_gallery_image(
  p_post_id uuid,
  p_image_id text,
  p_patch jsonb
) returns void
language sql
as $$
  update public.blog_posts
  set
    gallery_images = (
      select coalesce(
        jsonb_agg(
          case when elem->>'id' = p_image_id then elem || p_patch else elem end
          order by ord
        ),
        '[]'::jsonb
      )
      from jsonb_array_elements(blog_posts.gallery_images) with ordinality as t(elem, ord)
    ),
    updated_at = now()
  where id = p_post_id
    and content_type = 'gallery'
    and gallery_images is not null;
$$;

comment on function public.bailey_patch_gallery_image is
  'Bailey: atomically merge a jsonb patch into one gallery_images element (matched by id). Safe under concurrent per-image pipeline steps.';
