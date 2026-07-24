import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveMutationWorkspace } from '@/lib/workspace/active'
import {
  galleryImages,
  getGallery,
  rid,
  saveGalleryImages,
} from '@/lib/bailey/galleries'
import {
  GALLERY_BUCKET,
  MAX_IMAGES_PER_GALLERY,
  galleryPublicUrl,
  type GalleryImage,
} from '@/lib/bailey/constants'

interface Params {
  params: Promise<{ id: string }>
}

// POST — register an uploaded object as a gallery image (status: uploaded).
// Body: { tenantId, path }.
//
// NOTE: the client serialises these calls (uploads run in parallel, but
// registration is one-at-a-time) because this is a read-modify-write on the
// gallery_images array.
export async function POST(request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const workspace = await resolveMutationWorkspace(userId, body.tenantId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const gallery = await getGallery(id, workspace.tenantId)
  if (!gallery) return NextResponse.json({ error: 'Gallery not found' }, { status: 404 })

  const path = String(body.path ?? '')
  const expectedPrefix = `${workspace.tenantId}/${gallery.id}/`
  if (!path.startsWith(expectedPrefix) || path.includes('..')) {
    return NextResponse.json({ error: 'Invalid storage path' }, { status: 400 })
  }

  const images = galleryImages(gallery)
  if (images.length >= MAX_IMAGES_PER_GALLERY) {
    return NextResponse.json(
      { error: `This gallery already has ${MAX_IMAGES_PER_GALLERY} images (the maximum)` },
      { status: 400 },
    )
  }
  if (images.some((i) => i.storage_path === path)) {
    return NextResponse.json({ error: 'Image already registered' }, { status: 409 })
  }

  // Verify the object actually landed in Storage before recording it.
  const db = createAdminClient()
  const objectName = path.slice(expectedPrefix.length)
  const { data: listed, error: listError } = await db.storage
    .from(GALLERY_BUCKET)
    .list(expectedPrefix.replace(/\/$/, ''), { search: objectName })
  if (listError) return NextResponse.json({ error: listError.message }, { status: 500 })
  if (!listed?.some((o) => o.name === objectName)) {
    return NextResponse.json({ error: 'Uploaded file not found in storage' }, { status: 400 })
  }

  const image: GalleryImage = {
    id: `img_${rid()}`,
    storage_path: path,
    master_path: null,
    url: null,
    thumb_url: null,
    width: null,
    height: null,
    alt: null,
    caption: null,
    filename_slug: null,
    order: images.length,
    source: 'upload',
    source_ref: null,
    status: 'uploaded',
    error: null,
  }

  const saveError = await saveGalleryImages(gallery.id, [...images, image])
  if (saveError) return NextResponse.json({ error: saveError }, { status: 500 })

  return NextResponse.json({
    ok: true,
    image,
    // Source preview for the review UI (bucket is public-read); the stored
    // record's url/thumb_url stay null until processing writes the master.
    preview_url: galleryPublicUrl(process.env.NEXT_PUBLIC_SUPABASE_URL!, path),
  })
}

// DELETE — remove one or more images from the gallery, including their
// storage objects (source, master, any stored variants). Remaining images
// are re-ordered to close the gaps. Body: { tenantId, imageIds: string[] }.
export async function DELETE(request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const workspace = await resolveMutationWorkspace(userId, body.tenantId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const gallery = await getGallery(id, workspace.tenantId)
  if (!gallery) return NextResponse.json({ error: 'Gallery not found' }, { status: 404 })

  const imageIds: string[] = Array.isArray(body.imageIds) ? body.imageIds.map(String) : []
  if (!imageIds.length) return NextResponse.json({ error: 'imageIds is required' }, { status: 400 })

  const images = galleryImages(gallery)
  const toDelete = images.filter((i) => imageIds.includes(i.id))
  if (!toDelete.length) return NextResponse.json({ ok: true, deleted: 0 })

  const remaining = images
    .filter((i) => !imageIds.includes(i.id))
    .map((img, idx) => ({ ...img, order: idx }))

  const saveError = await saveGalleryImages(gallery.id, remaining)
  if (saveError) return NextResponse.json({ error: saveError }, { status: 500 })

  // Best-effort storage cleanup — the DB row is already consistent.
  const paths = toDelete.flatMap((i) =>
    [i.storage_path, i.master_path, ...(i.variants?.map((v) => v.path) ?? [])].filter(
      (p): p is string => Boolean(p),
    ),
  )
  if (paths.length) {
    const db = createAdminClient()
    await db.storage.from(GALLERY_BUCKET).remove(paths).catch(() => {})
  }

  return NextResponse.json({ ok: true, deleted: toDelete.length })
}
