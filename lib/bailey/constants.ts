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

/** Extension allowlist. HEIC is pending spike #3 (Vercel sharp decode) —
 *  until that passes we reject it with a clear message rather than failing
 *  silently mid-pipeline. */
export const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export const HEIC_REJECT_MESSAGE =
  "HEIC isn't supported yet — set your iPhone camera to 'Most Compatible' or export as JPEG first."

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
