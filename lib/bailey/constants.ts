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

/**
 * Spike #1 REVISITED 2026-09-08 — the escape hatch is now the live path.
 *
 * Transform URLs work, but Supabase bills Image Transformations per *origin
 * image per month*, and the Pro plan includes only 100. Every gallery image
 * gets a transform thumbnail, so the allowance is a hard ceiling on how many
 * images can exist across all tenants — 153 images put us at 153% with no
 * unusual traffic at all. It is a cost that scales with the archive rather
 * than with use, which is the wrong shape entirely.
 *
 * Stored variants are ordinary storage objects: no transformation billing,
 * and storage is the cheap resource (100GB included, ~500KB per master).
 *
 * This changes newly processed images only. Existing images keep the transform
 * thumbnails already recorded on them until they are reprocessed.
 */
export const USE_TRANSFORM_URLS = false

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
  /** Hidden images stay in the gallery (admin) but are excluded from the
   *  published page, the publish-readiness gate, and the lead image. */
  hidden?: boolean | null
  /** The image a consumer should lead with — gallery cover, og:image, and the
   *  home page hero on sites that use one. At most one per gallery; setting it
   *  clears the others. Falls back to the first ready image when unset. */
  lead?: boolean | null
  /** Set when a human edits alt or caption. Regenerating captions skips these
   *  by default — a re-run must never silently discard someone's corrections. */
  edited?: boolean | null
  /** Stored responsive variants — only populated in the spike-#1 fallback
   *  (USE_TRANSFORM_URLS = false); srcset comes from transform URLs otherwise. */
  variants?: { width: number; path: string; url: string }[] | null
}

/** Extract a lowercased extension ('' when none). */
export function fileExtension(filename: string): string {
  const idx = filename.lastIndexOf('.')
  return idx === -1 ? '' : filename.slice(idx + 1).toLowerCase()
}

// ── Tags ────────────────────────────────────────────────────────────────────

/** Tags per gallery. Clem suggests 3-6; hand-added groupings ("christmas")
 *  need some headroom on top of that. */
export const MAX_GALLERY_TAGS = 10

/** A tag is a grouping, not a sentence. */
export const MAX_GALLERY_TAG_LENGTH = 40

/** Clean a tag list: lowercase, inner whitespace collapsed, no commas (Shopify
 *  splits tags on them), no duplicates, capped. Lowercase is not cosmetic —
 *  Related reading and the Content API's ?tag= filter both match exactly, so
 *  "Christmas" and "christmas" would otherwise be two different groupings. */
export function normaliseGalleryTags(raw: unknown[]): string[] {
  const out: string[] = []
  for (const value of raw) {
    const tag = String(value ?? '')
      .toLowerCase()
      .replace(/,/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_GALLERY_TAG_LENGTH)
      .trim()
    if (tag && !out.includes(tag)) out.push(tag)
    if (out.length === MAX_GALLERY_TAGS) break
  }
  return out
}

/** Shopify's page listing every article in a blog with this tag, derived from
 *  one published article URL (https://host/blogs/<blog>/<handle>). Null for
 *  anything that isn't a Shopify article URL. The tag segment is Shopify's
 *  handle form: "christmas parties" → "christmas-parties". */
export function shopifyTagPageUrl(articleUrl: string | null, tag: string): string | null {
  const blog = articleUrl ? /^(https?:\/\/[^/]+\/blogs\/[^/?#]+)\/[^/?#]+/.exec(articleUrl) : null
  if (!blog) return null
  const handle = tag
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return handle ? `${blog[1]}/tagged/${handle}` : null
}

/** Public CDN URL for an object in the gallery bucket. */
export function galleryPublicUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${GALLERY_BUCKET}/${path}`
}
