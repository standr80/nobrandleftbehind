import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkspace, resolveMutationWorkspace } from '@/lib/workspace/active'
import { galleryImages, generateSlug, getGallery, rid } from '@/lib/bailey/galleries'
import { galleryPublicUrl } from '@/lib/bailey/constants'
import { repairRelatedLinks, runShopifyDelete, type RemovedPostRef } from '@/lib/clem/shopify'

// The delete itself is quick; the sibling link repair that follows it reads
// (and sometimes rewrites) each related article's live body.
export const maxDuration = 60

interface Params {
  params: Promise<{ id: string }>
}

// GET — fetch one gallery with per-image statuses (upload UI polling).
export async function GET(_request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const workspace = await getActiveWorkspace(userId)
  if (!workspace) return NextResponse.json({ error: 'No workspace found' }, { status: 404 })

  const gallery = await getGallery(id, workspace.tenantId)
  if (!gallery) return NextResponse.json({ error: 'Gallery not found' }, { status: 404 })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  return NextResponse.json({
    gallery: {
      id: gallery.id,
      title: gallery.title,
      slug: gallery.slug,
      status: gallery.status,
      context: gallery.gallery_context,
      images: galleryImages(gallery).map((img) => ({
        ...img,
        preview_url: img.thumb_url ?? img.url ?? galleryPublicUrl(supabaseUrl, img.storage_path),
      })),
    },
  })
}

// PATCH — edit the gallery. Body: { tenantId, title?, gallery_context?,
// slug?, body_mdx?, meta_description? }.
//
// Slug handling is the subtle part:
//  - renaming a DRAFT regenerates the slug from the new title. Nothing is
//    published, so there is no URL to break and the slug should follow the
//    title rather than fossilise whatever it was first called.
//  - renaming a PUBLISHED gallery leaves the slug alone. Changing it changes
//    the live URL and 404s any link already shared. The caller can still
//    change it deliberately by passing `slug`.
export async function PATCH(request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const workspace = await resolveMutationWorkspace(userId, body.tenantId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const gallery = await getGallery(id, workspace.tenantId)
  if (!gallery) return NextResponse.json({ error: 'Gallery not found' }, { status: 404 })

  const patch: {
    title?: string
    slug?: string
    gallery_show_captions?: boolean
    gallery_context?: string | null
    body_mdx?: string | null
    meta_description?: string | null
    updated_at?: string
  } = {}

  if (typeof body.title === 'string') {
    const title = body.title.trim()
    if (!title) {
      return NextResponse.json({ error: 'A gallery title is required' }, { status: 400 })
    }
    patch.title = title
  }
  if (typeof body.gallery_context === 'string') {
    patch.gallery_context = body.gallery_context.trim() || null
  }
  if (typeof body.gallery_show_captions === 'boolean') {
    patch.gallery_show_captions = body.gallery_show_captions
  }
  if (typeof body.body_mdx === 'string') patch.body_mdx = body.body_mdx.trim() || null
  if (typeof body.meta_description === 'string') patch.meta_description = body.meta_description.trim() || null

  // Work out the slug we want, if any.
  const isPublished = gallery.status === 'published'
  let wantedSlug: string | null = null
  if (typeof body.slug === 'string' && body.slug.trim()) {
    wantedSlug = generateSlug(body.slug)
    if (!wantedSlug) {
      return NextResponse.json(
        { error: 'That slug has no usable characters — use letters, numbers and hyphens' },
        { status: 400 },
      )
    }
  } else if (patch.title && !isPublished && patch.title !== gallery.title) {
    wantedSlug = generateSlug(patch.title)
  }
  if (wantedSlug === gallery.slug) wantedSlug = null

  if (!Object.keys(patch).length && !wantedSlug) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }
  patch.updated_at = new Date().toISOString()

  const db = createAdminClient()

  // Same collision strategy as creation: try the clean slug, then a suffixed
  // one. 23505 is a per-tenant unique violation on (tenant_id, slug).
  const candidates = wantedSlug
    ? [wantedSlug, `${wantedSlug}-${rid(4).toLowerCase()}`]
    : [null]

  for (const slug of candidates) {
    const attempt = slug ? { ...patch, slug } : patch
    const { data, error } = await db
      .from('blog_posts')
      .update(attempt)
      .eq('id', gallery.id)
      .eq('tenant_id', workspace.tenantId)
      .select('title, slug, gallery_context, gallery_show_captions, status')
      .single()

    if (!error && data) {
      return NextResponse.json({ ok: true, gallery: data, slugChanged: Boolean(slug) })
    }
    if (error && error.code !== '23505') {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json(
    { error: 'That slug is already used by another page — try a different title' },
    { status: 409 },
  )
}

// DELETE — remove the live Shopify article FIRST (no-op if never published;
// an already-deleted article counts as success), then soft-delete the row
// (deleted_at tombstone). If Shopify can't be reached the gallery is NOT
// deleted, so nothing is ever orphaned live — the user just retries.
// Storage objects are left in place; a cleanup sweep can reap them later.
// Finally, sibling pages that were linking to this gallery are repaired, so
// their Related-reading blocks don't keep pointing at a dead URL.
export async function DELETE(request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const workspace = await resolveMutationWorkspace(userId, body.tenantId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const gallery = await getGallery(id, workspace.tenantId)
  if (!gallery) return NextResponse.json({ error: 'Gallery not found' }, { status: 404 })

  let removed: RemovedPostRef | null = null
  try {
    removed = await runShopifyDelete(workspace.tenantId, gallery.id)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not remove the live Shopify article'
    return NextResponse.json(
      { error: `${message} — the gallery was NOT deleted so you can retry` },
      { status: 502 },
    )
  }

  const db = createAdminClient()
  const { error } = await db
    .from('blog_posts')
    .update({
      deleted_at: new Date().toISOString(),
      // The Shopify article is gone, so drop the pointers with it — nothing
      // should be able to treat this tombstoned row as a live, linkable page.
      shopify_article_id: null,
      shopify_article_url: null,
    })
    .eq('id', gallery.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Best-effort, and only after the tombstone is committed so the recomputed
  // blocks can't pick this gallery back up.
  if (removed) await repairRelatedLinks(workspace.tenantId, removed)

  return NextResponse.json({ ok: true })
}
