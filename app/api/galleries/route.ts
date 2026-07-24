import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkspace, resolveMutationWorkspace } from '@/lib/workspace/active'
import { generateSlug, rid } from '@/lib/bailey/galleries'
import type { GalleryImage } from '@/lib/bailey/constants'

const LIST_COLUMNS =
  'id, title, slug, status, gallery_images, gallery_context, created_at, updated_at'

// GET — list the active workspace's galleries (Bailey dashboard).
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getActiveWorkspace(userId)
  if (!workspace) return NextResponse.json({ error: 'No workspace found' }, { status: 404 })

  const db = createAdminClient()
  const { data, error } = await db
    .from('blog_posts')
    .select(LIST_COLUMNS)
    .eq('tenant_id', workspace.tenantId)
    .eq('content_type', 'gallery')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    galleries: (data ?? []).map((g) => {
      const images = Array.isArray(g.gallery_images) ? (g.gallery_images as unknown as GalleryImage[]) : []
      return {
        id: g.id,
        title: g.title,
        slug: g.slug,
        status: g.status,
        context: g.gallery_context,
        imageCount: images.length,
        readyCount: images.filter((i) => i.status === 'ready').length,
        failedCount: images.filter((i) => i.status === 'failed').length,
        created_at: g.created_at,
        updated_at: g.updated_at,
      }
    }),
  })
}

// POST — create a gallery. Body: { tenantId, title, context? }.
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const workspace = await resolveMutationWorkspace(userId, body.tenantId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const title = String(body.title ?? '').trim()
  if (!title) return NextResponse.json({ error: 'A gallery title is required' }, { status: 400 })
  const context = String(body.context ?? '').trim() || null

  const db = createAdminClient()
  const baseSlug = generateSlug(title) || `gallery-${rid(6)}`

  // Try the clean slug first; on a per-tenant collision, suffix a short id.
  for (const slug of [baseSlug, `${baseSlug}-${rid(4).toLowerCase()}`]) {
    const { data, error } = await db
      .from('blog_posts')
      .insert({
        tenant_id: workspace.tenantId,
        title,
        slug,
        status: 'draft',
        content_type: 'gallery',
        origin: 'manual',
        created_by: userId,
        gallery_images: [],
        gallery_context: context,
      })
      .select('id, title, slug, status, gallery_context, created_at')
      .single()

    if (!error && data) {
      return NextResponse.json({ ok: true, gallery: { ...data, imageCount: 0 } })
    }
    // 23505 = unique violation → retry with suffixed slug; anything else → fail
    if (error && error.code !== '23505') {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Could not create a unique slug — try a different title' }, { status: 500 })
}
