import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import sharp from 'sharp'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkspace } from '@/lib/workspace/active'
import { GALLERY_BUCKET, galleryTransformUrl } from '@/lib/bailey/constants'
import type { GalleryImage } from '@/lib/bailey/constants'

export const maxDuration = 60

// TEMPORARY — Bailey pre-build spikes #1 and #3. Hit this once on the
// DEPLOYED app (results differ from local!), record the answers in the
// build notes, then delete this route.
//
//   GET /api/galleries/spike
//
// Spike #1 — Supabase image transformations: fetches a render/transform URL
// for an existing gallery image (upload one first) and reports whether the
// plan supports it. Decides USE_TRANSFORM_URLS in lib/bailey/constants.ts.
//
// Spike #3 — HEIC decode: reports whether the deployed sharp/libvips build
// can decode HEIF. Decides whether .heic joins the upload allowlist.
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getActiveWorkspace(userId)
  if (!workspace) return NextResponse.json({ error: 'No workspace found' }, { status: 404 })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const db = createAdminClient()

  // ── Spike #1: transform URL on a real object ────────────────────────────
  let transform: Record<string, unknown> = { ok: false, note: 'No gallery image found to test with — upload one first' }
  const { data: posts } = await db
    .from('blog_posts')
    .select('gallery_images')
    .eq('tenant_id', workspace.tenantId)
    .eq('content_type', 'gallery')
    .is('deleted_at', null)
    .not('gallery_images', 'is', null)
    .limit(10)

  const firstImage = (posts ?? [])
    .flatMap((p) => (Array.isArray(p.gallery_images) ? (p.gallery_images as unknown as GalleryImage[]) : []))
    .find((i) => i.master_path ?? i.storage_path)

  if (firstImage) {
    const testPath = firstImage.master_path ?? firstImage.storage_path
    const url = galleryTransformUrl(supabaseUrl, testPath, 200, 60)
    try {
      const res = await fetch(url)
      const contentType = res.headers.get('content-type') ?? ''
      transform = {
        ok: res.ok && contentType.startsWith('image/'),
        status: res.status,
        contentType,
        bytes: Number(res.headers.get('content-length') ?? 0) || undefined,
        testedPath: testPath,
        url,
        verdict: res.ok && contentType.startsWith('image/')
          ? 'Transforms WORK — keep USE_TRANSFORM_URLS = true'
          : 'Transforms NOT available on this plan — set USE_TRANSFORM_URLS = false (stored variants)',
      }
    } catch (err) {
      transform = { ok: false, error: err instanceof Error ? err.message : String(err), url }
    }
  }

  // ── Spike #3: HEIF decode support in the deployed sharp build ───────────
  const heifFormat = sharp.format.heif as { input?: { buffer?: boolean; file?: boolean } } | undefined
  const heifInput = Boolean(heifFormat?.input?.buffer || heifFormat?.input?.file)
  const heic = {
    ok: heifInput,
    heifFormat: heifFormat ?? null,
    verdict: heifInput
      ? 'HEIF decode available — .heic can join the allowlist (test with a real iPhone photo before flipping)'
      : 'No HEIF decode in this sharp build — keep rejecting .heic at upload with the friendly message',
  }

  return NextResponse.json({
    note: 'TEMPORARY spike route — delete after recording results',
    environment: process.env.VERCEL ? 'vercel' : 'local',
    sharpVersions: sharp.versions,
    spike1_transforms: transform,
    spike3_heic: heic,
  })
}
