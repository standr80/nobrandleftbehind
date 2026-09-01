import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveMutationWorkspace } from '@/lib/workspace/active'
import { galleryImages, getGallery } from '@/lib/bailey/galleries'
import { leadImage } from '@/lib/bailey/render'
import { runShopifyPublish } from '@/lib/clem/shopify'
import { triggerDeployHook } from '@/lib/clem/deployHook'
import { publicPostUrl } from '@/lib/content/api'

export const maxDuration = 120

interface Params {
  params: Promise<{ id: string }>
}

// POST — publish a gallery. Body: { tenantId, attest?: boolean }.
//
// Gates (spec: review gate is binding):
//  - at least one image, and EVERY image must be 'ready' (fix or delete
//    failures first — nothing half-processed ever publishes)
//  - consent attestation required before first publish; stored with user id
//    + timestamp. Republshes reuse the stored attestation.
//
// The gates are the same whatever the destination; only the delivery differs,
// so they run before the cms_type branch below.
export async function POST(request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const workspace = await resolveMutationWorkspace(userId, body.tenantId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const gallery = await getGallery(id, workspace.tenantId)
  if (!gallery) return NextResponse.json({ error: 'Gallery not found' }, { status: 404 })

  // Hidden images are parked: excluded from the page AND from the readiness
  // gate, so a questionable image never blocks publishing the rest.
  const visible = galleryImages(gallery).filter((i) => !i.hidden)
  if (!visible.length) {
    return NextResponse.json(
      { error: 'Nothing to publish — every image is hidden or the gallery is empty' },
      { status: 400 },
    )
  }
  const notReady = visible.filter((i) => i.status !== 'ready')
  if (notReady.length) {
    return NextResponse.json(
      { error: `${notReady.length} visible image${notReady.length === 1 ? ' is' : 's are'} not ready — retry, hide or delete them first` },
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

  // ── Destination ───────────────────────────────────────────────────────────
  // Mirrors the branch in app/api/clem/publish/route.ts. Galleries were
  // Shopify-only until now, which meant a non-Shopify tenant could build a
  // gallery and then have nowhere to send it.
  const { data: tenantRow } = await db
    .from('tenants')
    .select('cms_type, domain')
    .eq('id', workspace.tenantId)
    .single()
  const tenant = tenantRow as { cms_type?: string | null; domain?: string | null } | null
  const cmsType = tenant?.cms_type ?? null

  // Git tenants publish by committing body_mdx to a repo. A gallery's content
  // is its gallery_images array, not its body — sending one down that path
  // would open a PR containing the intro copy and none of the photographs.
  // Better an honest refusal than a silently empty gallery.
  if (cmsType === 'git') {
    return NextResponse.json(
      {
        error:
          'Publishing galleries to a git-backed site is not supported yet — a git publish carries the post body only, so the images would be dropped.',
      },
      { status: 400 },
    )
  }

  try {
    if (cmsType === 'shopify') {
      await runShopifyPublish(workspace.tenantId, gallery.id)
    } else {
      await runDirectPublish(db, workspace.tenantId, gallery.id, visible)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Publish failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const { data: updated } = await db
    .from('blog_posts')
    .select('status, slug, shopify_article_url')
    .eq('id', gallery.id)
    .single()
  const row = updated as
    | { status?: string | null; slug?: string | null; shopify_article_url?: string | null }
    | null

  // A direct publish produces no Shopify article, so there was previously
  // nothing to return and the dashboard showed no link at all — the gallery
  // published fine but appeared to vanish. Derive the live URL from the
  // tenant's own domain instead.
  const url =
    row?.shopify_article_url ??
    (tenant?.domain && row?.slug
      ? publicPostUrl(tenant.domain, row.slug, 'gallery')
      : null)

  return NextResponse.json({
    ok: true,
    status: row?.status ?? 'published',
    url,
  })
}

/**
 * Direct publish — for tenants whose site reads the public Content API
 * (`cms_type` 'embed' and anything else that is neither shopify nor git).
 *
 * There is nothing to push: the gallery is live the moment it is marked
 * published, because the consumer reads straight from the API. So this stamps
 * the row, records the log entry, and fires the deploy hook (which also purges
 * the tenant's cached API responses).
 */
async function runDirectPublish(
  db: ReturnType<typeof createAdminClient>,
  tenantId: string,
  galleryId: string,
  visible: ReturnType<typeof galleryImages>,
): Promise<void> {
  const now = new Date().toISOString()

  const { data: existing } = await db
    .from('blog_posts')
    .select('published_at')
    .eq('id', galleryId)
    .single()
  // Preserve the original publication date across republishes, exactly as the
  // Shopify path does — an edit is not a new publication.
  const publishedAt = (existing as { published_at?: string | null } | null)?.published_at ?? now

  // Galleries carry no hero_image_url of their own: the Shopify path derives a
  // featured image from the lead image at push time. A Content API consumer has
  // no equivalent hook, so stamp it here. It gives gallery listings a cover
  // image without them having to fetch every image array, and it feeds og:image.
  const lead = leadImage(visible)

  const { error } = await db
    .from('blog_posts')
    .update({
      status: 'published',
      published_at: publishedAt,
      ...(lead?.url
        ? { hero_image_url: lead.url, hero_image_alt: lead.alt ?? null }
        : {}),
      updated_at: now,
    })
    .eq('id', galleryId)
    .eq('tenant_id', tenantId)

  if (error) throw new Error(`Publish failed: ${error.message}`)

  await db.from('publish_log').insert({
    tenant_id: tenantId,
    post_id: galleryId,
    action: 'direct_publish_gallery',
    success: true,
    response_data: { resource: 'gallery', images: visible.length },
    attempted_at: now,
  })

  await triggerDeployHook(tenantId)
}
