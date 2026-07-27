import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveMutationWorkspace } from '@/lib/workspace/active'
import { galleryImages, getGallery } from '@/lib/bailey/galleries'
import { runShopifyPublish } from '@/lib/clem/shopify'

export const maxDuration = 120

interface Params {
  params: Promise<{ id: string }>
}

// POST — publish a gallery to Shopify. Body: { tenantId, attest?: boolean }.
//
// Gates (spec: review gate is binding):
//  - at least one image, and EVERY image must be 'ready' (fix or delete
//    failures first — nothing half-processed ever publishes)
//  - consent attestation required before first publish; stored with user id
//    + timestamp. Republshes reuse the stored attestation.
export async function POST(request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const workspace = await resolveMutationWorkspace(userId, body.tenantId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const gallery = await getGallery(id, workspace.tenantId)
  if (!gallery) return NextResponse.json({ error: 'Gallery not found' }, { status: 404 })

  const images = galleryImages(gallery)
  if (!images.length) {
    return NextResponse.json({ error: 'Add some images before publishing' }, { status: 400 })
  }
  const notReady = images.filter((i) => i.status !== 'ready')
  if (notReady.length) {
    return NextResponse.json(
      { error: `${notReady.length} image${notReady.length === 1 ? ' is' : 's are'} not ready — retry or delete failed images first` },
      { status: 400 },
    )
  }

  const db = createAdminClient()

  // Consent attestation: required once, stored for the record.
  if (!gallery.consent_attested_at) {
    if (body.attest !== true) {
      return NextResponse.json(
        { error: 'Publish requires the consent attestation checkbox' },
        { status: 400 },
      )
    }
    const { error: attestErr } = await db
      .from('blog_posts')
      .update({ consent_attested_by: userId, consent_attested_at: new Date().toISOString() })
      .eq('id', gallery.id)
    if (attestErr) return NextResponse.json({ error: attestErr.message }, { status: 500 })
  }

  try {
    await runShopifyPublish(workspace.tenantId, gallery.id)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Publish failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const { data: updated } = await db
    .from('blog_posts')
    .select('status, shopify_article_url')
    .eq('id', gallery.id)
    .single()

  return NextResponse.json({
    ok: true,
    status: updated?.status ?? 'published',
    url: updated?.shopify_article_url ?? null,
  })
}
