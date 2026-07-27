import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkspace, resolveMutationWorkspace } from '@/lib/workspace/active'
import { getGallery, galleryImages } from '@/lib/bailey/galleries'
import { galleryPublicUrl } from '@/lib/bailey/constants'

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

// PATCH — edit gallery page copy. Body: { tenantId, body_mdx?, meta_description? }.
export async function PATCH(request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const workspace = await resolveMutationWorkspace(userId, body.tenantId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const gallery = await getGallery(id, workspace.tenantId)
  if (!gallery) return NextResponse.json({ error: 'Gallery not found' }, { status: 404 })

  const patch: { body_mdx?: string | null; meta_description?: string | null; updated_at?: string } = {}
  if (typeof body.body_mdx === 'string') patch.body_mdx = body.body_mdx.trim() || null
  if (typeof body.meta_description === 'string') patch.meta_description = body.meta_description.trim() || null
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }
  patch.updated_at = new Date().toISOString()

  const db = createAdminClient()
  const { error } = await db.from('blog_posts').update(patch).eq('id', gallery.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — soft-delete a gallery (deleted_at tombstone, consistent with the
// Content API's soft-delete columns). Storage objects are left in place for
// now; a cleanup sweep can reap orphaned folders later.
export async function DELETE(request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const workspace = await resolveMutationWorkspace(userId, body.tenantId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const gallery = await getGallery(id, workspace.tenantId)
  if (!gallery) return NextResponse.json({ error: 'Gallery not found' }, { status: 404 })

  const db = createAdminClient()
  const { error } = await db
    .from('blog_posts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', gallery.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
