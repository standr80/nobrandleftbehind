import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { resolveMutationWorkspace } from '@/lib/workspace/active'
import { galleryImages, getGallery } from '@/lib/bailey/galleries'
import { rotateMaster } from '@/lib/bailey/process'

export const maxDuration = 60

interface Params {
  params: Promise<{ id: string; imageId: string }>
}

// POST — manually rotate an image's master (human override when the
// automatic orientation passes miss). Body: { tenantId, degrees: 90|180|270 }.
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

  const degrees = Number(body.degrees)
  if (degrees !== 90 && degrees !== 180 && degrees !== 270) {
    return NextResponse.json({ error: 'degrees must be 90, 180 or 270' }, { status: 400 })
  }

  const result = await rotateMaster(gallery.id, image, degrees)
  if ('error' in result && result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  return NextResponse.json({ ok: true, image: { ...image, ...result } })
}
