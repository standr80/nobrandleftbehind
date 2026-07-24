import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { aiErrorResponse } from '@/lib/anthropic'
import { resolveMutationWorkspace } from '@/lib/workspace/active'
import { galleryImages, getGallery } from '@/lib/bailey/galleries'
import { enrichImage, getTenantEnrichContext } from '@/lib/bailey/enrich'

export const maxDuration = 60

interface Params {
  params: Promise<{ id: string; imageId: string }>
}

// POST — vision-enrich one processed image (alt + caption + descriptive
// filename slug), then mark it ready. Body: { tenantId }.
// Valid from 'processed', or 'failed' when a master already exists (retry
// from last good step).
export async function POST(request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, imageId } = await params
  const body = await request.json().catch(() => ({}))
  const workspace = await resolveMutationWorkspace(userId, body.tenantId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const gallery = await getGallery(id, workspace.tenantId)
  if (!gallery) return NextResponse.json({ error: 'Gallery not found' }, { status: 404 })

  const image = galleryImages(gallery).find((i) => i.id === imageId)
  if (!image) return NextResponse.json({ error: 'Image not found' }, { status: 404 })

  const retryable = image.status === 'processed' || (image.status === 'failed' && image.master_path)
  if (!retryable) {
    return NextResponse.json(
      { error: `Image is '${image.status}' — enrichment runs after processing` },
      { status: 409 },
    )
  }

  const ctx = await getTenantEnrichContext(workspace.tenantId)
  const patch = await enrichImage(gallery, image, ctx)
  if (patch.status === 'failed') {
    const { error, status } = aiErrorResponse(new Error(patch.error ?? 'Enrichment failed'))
    return NextResponse.json({ ok: false, error, image: { ...image, ...patch } }, { status })
  }
  return NextResponse.json({ ok: true, image: { ...image, ...patch } })
}
