import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { resolveMutationWorkspace } from '@/lib/workspace/active'
import { galleryImages, getGallery } from '@/lib/bailey/galleries'
import { processImage } from '@/lib/bailey/process'

// sharp needs the Node runtime and real work time.
export const maxDuration = 60

interface Params {
  params: Promise<{ id: string; imageId: string }>
}

// POST — run the sharp pass for one image. Body: { tenantId }.
// Valid from status 'uploaded', or 'failed' (retry re-runs from the last
// good step — a failed process retries processing).
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

  if (image.status !== 'uploaded' && image.status !== 'failed') {
    return NextResponse.json(
      { error: `Image is '${image.status}' — processing runs from 'uploaded' or 'failed'` },
      { status: 409 },
    )
  }

  const patch = await processImage(gallery.id, image)
  if (patch.status === 'failed') {
    return NextResponse.json({ ok: false, image: { ...image, ...patch } }, { status: 500 })
  }
  return NextResponse.json({ ok: true, image: { ...image, ...patch } })
}
