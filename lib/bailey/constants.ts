// Bailey — image gallery agent. Client-safe constants + types (no server
// imports here; this file is shared by browser components and API routes).

/** Supabase Storage bucket for gallery images. Public read; writes only via
 *  signed upload URLs issued by /api/galleries/[id]/upload-url. */
export const GALLERY_BUCKET = 'gallery-images'

/** Max source image size (10MB) — enforced at signed-URL issuance AND as the
 *  bucket-level file_size_limit. */
export const MAX_SOURCE_BYTES = 10 * 1024 * 1024

/** Max images per gallery. */
export const MAX_IMAGES_PER_GALLERY = 50

/** Extension allowlist. Spike #3 RESOLVED 2026-07-24: the deployed sharp/
 *  libvips build decodes AVIF only (aom, no libde265/x265), and iPhone HEIC
 *  is HEVC — so real HEICs would fail. HEIC stays rejected at upload with a
 *  clear message rather than failing silently mid-pipeline. */
export const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export const HEIC_REJECT_MESSAGE =
  "HEIC isn't supported yet — set your iPhone camera to 'Most Compatible' or export as JPEG first."

// ── Processing (stage 3) ────────────────────────────────────────────────────

/** Spike #1 RESOLVED 2026-07-24 on production: Supabase render/transform
 *  URLs work on this plan (200, image/jpeg, auto-format). Thumbs + srcset
 *  are transform URLs off the single master — no stored variants, free
 *  resizing later. The `false` branch (stored variants) remains implemented
 *  as an escape hatch if plan/pricing ever changes. */
export const USE_TRANSFORM_URLS = true

/** Web master: max long edge + WebP quality. */
export const MASTER_MAX_EDGE = 2000
export const MASTER_WEBP_QUALITY = 82

/** Stored-variant fallback sizes (spike #1 = no). */
export const THUMB_WIDTH = 400
export const VARIANT_WIDTHS = [800, 1400] as const

/** Thumb width when using transform URLs. */
export const TRANSFORM_THUMB_WIDTH = 400

/** Supabase image transformation URL for a public object. */
export function galleryTransformUrl(
  supabaseUrl: string,
  path: string,
  width: number,
  quality = 75,
): string {
  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/render/image/public/${GALLERY_BUCKET}/${path}?width=${width}&quality=${quality}`
}

export type GalleryImageStatus =
  | 'importing'
  | 'uploaded'
  | 'processed'
  | 'enriched'
  | 'ready'
  | 'failed'

/** One entry in blog_posts.gallery_images (ordered array). */
export interface GalleryImage {
  id: string // img_<random>
  storage_path: string // source object (random key, never user filenames)
  master_path: string | null // processed web master
  url: string | null // public CDN URL of master
  thumb_url: string | null // transform URL or stored variant (spike #1)
  width: number | null // of master — required on <img> at render
  height: number | null
  alt: string | null // AI draft, user-editable
  caption: string | null // AI draft, user-editable, rendered as <figcaption>
  filename_slug: string | null // descriptive slug used for variant names
  order: number
  source: 'upload' | 'gdrive'
  source_ref: string | null // e.g. Drive file ID (Phase 1.5)
  status: GalleryImageStatus
  error: string | null
  /** Stored responsive variants — only populated in the spike-#1 fallback
   *  (USE_TRANSFORM_URLS = false); srcset comes from transform URLs otherwise. */
  variants?: { width: number; path: string; url: string }[] | null
}

/** Extract a lowercased extension ('' when none). */
export function fileExtension(filename: string): string {
  const idx = filename.lastIndexOf('.')
  return idx === -1 ? '' : filename.slice(idx + 1).toLowerCase()
}

/** Public CDN URL for an object in the gallery bucket. */
export function galleryPublicUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${GALLERY_BUCKET}/${path}`
}
