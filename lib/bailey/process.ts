// Bailey stage 3 — sharp processing of a source image into the web master.
//
// Per image: decode → auto-orient from EXIF → strip ALL metadata (sharp
// strips by default when re-encoding — no .withMetadata() call — which is
// the GPS-privacy requirement: staff phone photos carry location) → write
// web master (max 2000px long edge, WebP q82) → capture width/height →
// (fallback only: write thumb + responsive variants) → status: processed.

import sharp from 'sharp'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/supabase/types'
import {
  GALLERY_BUCKET,
  MASTER_MAX_EDGE,
  MASTER_WEBP_QUALITY,
  THUMB_WIDTH,
  TRANSFORM_THUMB_WIDTH,
  USE_TRANSFORM_URLS,
  VARIANT_WIDTHS,
  galleryPublicUrl,
  galleryTransformUrl,
  type GalleryImage,
} from './constants'

/** Atomically merge a patch into one gallery_images element. */
export async function patchGalleryImage(
  postId: string,
  imageId: string,
  patch: Partial<GalleryImage>,
): Promise<string | null> {
  const db = createAdminClient()
  const { error } = await db.rpc('bailey_patch_gallery_image', {
    p_post_id: postId,
    p_image_id: imageId,
    p_patch: patch as unknown as Json,
  })
  return error ? error.message : null
}

/** Run the sharp pass for one image and persist the result (status:
 *  processed on success, failed + error on any exception). Returns the
 *  patch applied. */
export async function processImage(
  galleryId: string,
  image: GalleryImage,
): Promise<Partial<GalleryImage>> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const db = createAdminClient()
  try {
    // Download the source (service role).
    const { data: blob, error: dlError } = await db.storage
      .from(GALLERY_BUCKET)
      .download(image.storage_path)
    if (dlError || !blob) throw new Error(dlError?.message ?? 'Could not download source image')
    const source = Buffer.from(await blob.arrayBuffer())

    // ONE pass: auto-orient, resize within 2000px, WebP. Metadata (EXIF/GPS)
    // is stripped because we re-encode without .withMetadata().
    const master = await sharp(source)
      .rotate() // honour EXIF orientation, then discard it
      .resize(MASTER_MAX_EDGE, MASTER_MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: MASTER_WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true })

    // Master lives next to the source; slug-naming happens at enrichment
    // (the descriptive-filename write) — this name is the pre-enrichment key.
    const sourceKey = image.storage_path.split('/').pop()!.replace(/\.[^.]+$/, '')
    const dir = image.storage_path.slice(0, image.storage_path.lastIndexOf('/'))
    const masterPath = `${dir}/${sourceKey}-master.webp`

    const { error: upError } = await db.storage
      .from(GALLERY_BUCKET)
      .upload(masterPath, master.data, { contentType: 'image/webp', upsert: true })
    if (upError) throw new Error(`Master upload failed: ${upError.message}`)

    const patch: Partial<GalleryImage> = {
      master_path: masterPath,
      url: galleryPublicUrl(supabaseUrl, masterPath),
      width: master.info.width,
      height: master.info.height,
      status: 'processed',
      error: null,
    }

    if (USE_TRANSFORM_URLS) {
      // Thumbs + srcset are transform URLs on the master — nothing stored.
      patch.thumb_url = galleryTransformUrl(supabaseUrl, masterPath, TRANSFORM_THUMB_WIDTH)
      patch.variants = null
    } else {
      // Spike-#1 fallback: stored thumb + responsive variants.
      const variants: NonNullable<GalleryImage['variants']> = []
      for (const width of [THUMB_WIDTH, ...VARIANT_WIDTHS]) {
        if (width >= master.info.width) continue // never upscale
        const resized = await sharp(master.data)
          .resize(width)
          .webp({ quality: MASTER_WEBP_QUALITY })
          .toBuffer()
        const variantPath = `${dir}/${sourceKey}-${width}.webp`
        const { error: vErr } = await db.storage
          .from(GALLERY_BUCKET)
          .upload(variantPath, resized, { contentType: 'image/webp', upsert: true })
        if (vErr) throw new Error(`Variant ${width}px upload failed: ${vErr.message}`)
        variants.push({ width, path: variantPath, url: galleryPublicUrl(supabaseUrl, variantPath) })
      }
      patch.thumb_url = variants[0]?.url ?? patch.url
      patch.variants = variants.filter((v) => v.width !== THUMB_WIDTH)
    }

    const saveError = await patchGalleryImage(galleryId, image.id, patch)
    if (saveError) throw new Error(saveError)
    return patch
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Processing failed'
    const patch: Partial<GalleryImage> = { status: 'failed', error: message }
    await patchGalleryImage(galleryId, image.id, patch)
    return patch
  }
}
