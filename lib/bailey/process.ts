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

/** Physically rotate an image's master by 90/180/270 (clockwise) and
 *  persist. Writes a NEW object (cache-safe: Supabase CDN caches public
 *  URLs, so overwriting in place would serve stale pixels), removes the old
 *  one, and updates paths/dimensions. */
export async function rotateMaster(
  galleryId: string,
  image: GalleryImage,
  degrees: 90 | 180 | 270,
): Promise<Partial<GalleryImage> | { error: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const db = createAdminClient()
  try {
    if (!image.master_path) return { error: 'Image has no processed master yet' }
    const { data: blob, error: dlErr } = await db.storage
      .from(GALLERY_BUCKET)
      .download(image.master_path)
    if (dlErr || !blob) throw new Error(dlErr?.message ?? 'Could not download master')

    const rotated = await sharp(Buffer.from(await blob.arrayBuffer()))
      .rotate(degrees)
      .webp({ quality: MASTER_WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true })

    const base = image.master_path.replace(/\.webp$/, '').replace(/-r\d+$/, '')
    const newPath = `${base}-r${Date.now() % 100000}.webp`

    const { error: upErr } = await db.storage
      .from(GALLERY_BUCKET)
      .upload(newPath, rotated.data, { contentType: 'image/webp', upsert: true })
    if (upErr) throw new Error(upErr.message)
    await db.storage.from(GALLERY_BUCKET).remove([image.master_path]).catch(() => {})

    const patch: Partial<GalleryImage> = {
      master_path: newPath,
      url: galleryPublicUrl(supabaseUrl, newPath),
      thumb_url: USE_TRANSFORM_URLS
        ? galleryTransformUrl(supabaseUrl, newPath, TRANSFORM_THUMB_WIDTH)
        : image.thumb_url,
      width: rotated.info.width,
      height: rotated.info.height,
    }
    const saveError = await patchGalleryImage(galleryId, image.id, patch)
    if (saveError) throw new Error(saveError)
    return patch
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Rotation failed' }
  }
}

/** Shopify's featured-image ingestion rejects both WebP and (empirically)
 *  URL-sourcing from the Supabase CDN entirely — so the featured image is
 *  pushed into Shopify via staged upload instead. This builds the JPEG
 *  bytes for that: download master → JPEG q85 → { data, filename }. */
export async function buildFeaturedJpegBuffer(
  image: GalleryImage,
): Promise<{ data: Buffer; filename: string } | null> {
  const db = createAdminClient()
  if (!image.master_path) return null
  const { data: blob, error: dlErr } = await db.storage
    .from(GALLERY_BUCKET)
    .download(image.master_path)
  if (dlErr || !blob) return null

  const jpeg = await sharp(Buffer.from(await blob.arrayBuffer()))
    .jpeg({ quality: 85 })
    .toBuffer()
  const base = image.master_path.split('/').pop()!.replace(/\.webp$/, '')
  return { data: jpeg, filename: `${base}.jpg` }
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
