import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { resolveMutationWorkspace } from '@/lib/workspace/active'
import { galleryImages, getGallery } from '@/lib/bailey/galleries'
import { processImage } from '@/lib/bailey/process'
import { enrichImage, getTenantEnrichContext } from '@/lib/bailey/enrich'
import type { GalleryImage } from '@/lib/bailey/constants'

export const maxDuration = 300

interface Params {
  params: Promise<{ id: string }>
}

// POST — belt-and-braces sweep: run any image that isn't 'ready' forward
// from its last good step, sequentially. Body: { tenantId }.
//   uploaded            → process → enrich
//   processed           → enrich
//   failed, no master   → process → enrich
//   failed, has master  → enrich
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
    (i) => i.status !== 'ready' && i.status !== 'importing',
  )
  if (!stuck.length) return NextResponse.json({ ok: true, swept: 0, ready: 0, failed: 0 })

  const ctx = await getTenantEnrichContext(workspace.tenantId)
  let ready = 0
  let failed = 0

  for (let image of stuck) {
    if (!image.master_path || image.status === 'uploaded') {
      const patch = await processImage(gallery.id, image)
      if (patch.status === 'failed') {
        failed += 1
        continue
      }
      image = { ...image, ...patch } as GalleryImage
    }
    const patch = await enrichImage(gallery, image, ctx)
    if (patch.status === 'failed') failed += 1
    else ready += 1
  }

  return NextResponse.json({ ok: true, swept: stuck.length, ready, failed })
}
