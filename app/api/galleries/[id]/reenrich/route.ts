import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { resolveMutationWorkspace } from '@/lib/workspace/active'
import { galleryImages, getGallery } from '@/lib/bailey/galleries'
import { enrichImage, getTenantEnrichContext, selectReenrichTargets } from '@/lib/bailey/enrich'

export const maxDuration = 300

interface Params {
  params: Promise<{ id: string }>
}

/**
 * POST — regenerate alt text and captions across a gallery.
 * Body: { tenantId, overwriteEdited?: boolean }.
 *
 * The per-image enrich route only runs forward from 'processed' or a retryable
 * 'failed', so a finished gallery could never be improved. That mattered
 * because the biggest lever on caption quality is the gallery's context field,
 * and improving it after the fact had no effect on anything already done.
 *
 * Skipped by default:
 *  - images a human has edited (`edited`), unless overwriteEdited is set. A
 *    re-run must never silently discard someone's corrections.
 *  - hidden images, which are parked and excluded from the published page.
 *  - images that never finished processing — those are reconcile's job.
 *
 * Sequential, mirroring reconcile: vision calls are the slow part and running
 * them in parallel risks the function timeout and rate limits alike.
 */
export async function POST(request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const workspace = await resolveMutationWorkspace(userId, body.tenantId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const gallery = await getGallery(id, workspace.tenantId)
  if (!gallery) return NextResponse.json({ error: 'Gallery not found' }, { status: 404 })

  const overwriteEdited = body.overwriteEdited === true

  const { targets, skippedEdited } = selectReenrichTargets(
    galleryImages(gallery),
    overwriteEdited,
  )

  if (!targets.length) {
    return NextResponse.json({
      ok: true,
      regenerated: 0,
      failed: 0,
      skippedEdited,
      message: skippedEdited
        ? 'Every image has been edited by hand — tick the overwrite box to regenerate them anyway.'
        : 'Nothing to regenerate.',
    })
  }

  const ctx = await getTenantEnrichContext(workspace.tenantId)
  let regenerated = 0
  let failed = 0

  for (const image of targets) {
    const patch = await enrichImage(gallery, image, ctx)
    if (patch.status === 'failed') {
      failed += 1
      continue
    }
    // Fresh AI text is a draft again, so a later run is free to improve it.
    // Without this, overwriting an edited image would leave it flagged as
    // hand-authored and it would be skipped for ever after.
    if (image.edited) {
      const { patchGalleryImage } = await import('@/lib/bailey/process')
      await patchGalleryImage(gallery.id, image.id, { edited: false })
    }
    regenerated += 1
  }

  return NextResponse.json({
    ok: true,
    regenerated,
    failed,
    skippedEdited,
    // Enrichment renames the master from the new caption slug, so URLs move.
    // A published gallery keeps serving the old ones until it is republished.
    urlsChanged: regenerated > 0 && gallery.status === 'published',
  })
}
