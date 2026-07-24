import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveMutationWorkspace } from '@/lib/workspace/active'
import {
  ensureGalleryBucket,
  galleryImages,
  getGallery,
  rid,
} from '@/lib/bailey/galleries'
import {
  ALLOWED_EXTENSIONS,
  GALLERY_BUCKET,
  HEIC_REJECT_MESSAGE,
  MAX_IMAGES_PER_GALLERY,
  MAX_SOURCE_BYTES,
  fileExtension,
} from '@/lib/bailey/constants'

interface Params {
  params: Promise<{ id: string }>
}

// POST — issue a signed upload URL for ONE image file.
// Body: { tenantId, filename, size }.
//
// The security gate lives HERE, at issuance (the bucket's own limits are the
// backstop): tenant membership, extension allowlist, 10MB cap, gallery image
// cap. Object keys are randomised server-side so uploads can never collide,
// overwrite, or use a trusted user filename.
export async function POST(request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const workspace = await resolveMutationWorkspace(userId, body.tenantId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const gallery = await getGallery(id, workspace.tenantId)
  if (!gallery) return NextResponse.json({ error: 'Gallery not found' }, { status: 404 })

  const filename = String(body.filename ?? '')
  const size = Number(body.size ?? 0)

  const ext = fileExtension(filename)
  if (ext === 'heic' || ext === 'heif') {
    return NextResponse.json({ error: HEIC_REJECT_MESSAGE }, { status: 400 })
  }
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    return NextResponse.json(
      { error: `Unsupported file type ".${ext || '?'}" — use ${ALLOWED_EXTENSIONS.join(', ')}` },
      { status: 400 },
    )
  }
  if (!Number.isFinite(size) || size <= 0) {
    return NextResponse.json({ error: 'File size is required' }, { status: 400 })
  }
  if (size > MAX_SOURCE_BYTES) {
    return NextResponse.json(
      { error: `Image is ${(size / 1024 / 1024).toFixed(1)}MB — the limit is ${MAX_SOURCE_BYTES / 1024 / 1024}MB per image` },
      { status: 400 },
    )
  }
  if (galleryImages(gallery).length >= MAX_IMAGES_PER_GALLERY) {
    return NextResponse.json(
      { error: `This gallery already has ${MAX_IMAGES_PER_GALLERY} images (the maximum)` },
      { status: 400 },
    )
  }

  await ensureGalleryBucket()

  // Randomised key — never derived from the user's filename.
  const path = `${workspace.tenantId}/${gallery.id}/${rid()}.${ext === 'jpeg' ? 'jpg' : ext}`

  const db = createAdminClient()
  const { data, error } = await db.storage.from(GALLERY_BUCKET).createSignedUploadUrl(path)
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Could not create upload URL' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, path: data.path, token: data.token })
}
