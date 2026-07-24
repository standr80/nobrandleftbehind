import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { resolveMutationWorkspace } from '@/lib/workspace/active'
import { galleryImages, getGallery } from '@/lib/bailey/galleries'
import { processImage } from '@/lib/bailey/process'

export const maxDuration = 300

interface Params {
  params: Promise<{ id: string }>
}

// POST — belt-and-braces sweep: re-run any image stuck at 'uploaded' or
// 'failed' from its last good step, sequentially. Body: { tenantId }.
// Callable from the UI ("Retry failed"); cron-able later.
export async function POST(request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const workspace = await resolveMutationWorkspace(userId, body.tenantId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const gallery = await getGallery(id, workspace.tenantId)
  if (!gallery) return NextResponse.json({ error: 'Gallery not found' }, { status: 404 })

  const stuck = galleryImages(gallery).filter(
    (i) => i.status === 'uploaded' || i.status === 'failed',
  )

  let processed = 0
  let failed = 0
  for (const image of stuck) {
    // Failed images with a master already written just need later steps —
    // for now (pre-enrichment) everything re-runs the sharp pass, which is
    // idempotent (upsert to the same master path).
    const patch = await processImage(gallery.id, image)
    if (patch.status === 'failed') failed += 1
    else processed += 1
  }

  return NextResponse.json({ ok: true, swept: stuck.length, processed, failed })
}
