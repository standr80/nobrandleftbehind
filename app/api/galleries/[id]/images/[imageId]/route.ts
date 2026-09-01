import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { resolveMutationWorkspace } from '@/lib/workspace/active'
import { galleryImages, getGallery } from '@/lib/bailey/galleries'
import { patchGalleryImage } from '@/lib/bailey/process'
import type { GalleryImage } from '@/lib/bailey/constants'

interface Params {
  params: Promise<{ id: string; imageId: string }>
}

// PATCH — edit an image's user-facing text. Body: { tenantId, alt?, caption? }.
// AI output is a draft; this is the human-review edit path.
export async function PATCH(request: Request, { params }: Params) {
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

  const patch: Partial<GalleryImage> = {}
  if (typeof body.alt === 'string') patch.alt = body.alt.trim() || null
  if (typeof body.caption === 'string') patch.caption = body.caption.trim() || null
  if (typeof body.hidden === 'boolean') patch.hidden = body.hidden

  // Mark the text as human-authored so a later "regenerate captions" run leaves
  // it alone. Hiding an image is not an edit to its text, so it doesn't count.
  if (typeof body.alt === 'string' || typeof body.caption === 'string') {
    patch.edited = true
  }
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'Nothing to update — send alt, caption and/or hidden' }, { status: 400 })
  }

  const saveError = await patchGalleryImage(gallery.id, imageId, patch)
  if (saveError) return NextResponse.json({ error: saveError }, { status: 500 })

  return NextResponse.json({ ok: true, image: { ...image, ...patch } })
}
