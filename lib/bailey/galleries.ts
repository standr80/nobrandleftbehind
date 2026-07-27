// Bailey — server-side gallery helpers (service-role Supabase, tenant
// scoping enforced by callers via the workspace helpers, matching the FAQ
// module conventions in lib/clem/faq.ts).

import { randomBytes } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/supabase/types'
import {
  ALLOWED_MIME_TYPES,
  GALLERY_BUCKET,
  MAX_SOURCE_BYTES,
  type GalleryImage,
} from './constants'

/** Short URL-safe random id (used for object keys + image ids). */
export function rid(length = 12): string {
  return randomBytes(9).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').slice(0, length)
}

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80)
}

/** Idempotently create the gallery bucket: public read, 10MB cap, image
 *  mimes only. Same lazy pattern as the hero-images bucket. */
export async function ensureGalleryBucket(): Promise<void> {
  const db = createAdminClient()
  await db.storage
    .createBucket(GALLERY_BUCKET, {
      public: true,
      fileSizeLimit: MAX_SOURCE_BYTES,
      allowedMimeTypes: [...ALLOWED_MIME_TYPES],
    })
    .catch(() => {}) // already exists
}

const GALLERY_COLUMNS =
  'id, tenant_id, title, slug, status, content_type, cluster_id, gallery_images, gallery_context, consent_attested_by, consent_attested_at, shopify_article_url, created_at, updated_at'

export interface GalleryRow {
  id: string
  tenant_id: string
  title: string
  slug: string
  status: string | null
  content_type: string
  cluster_id: string | null
  gallery_images: GalleryImage[] | null
  gallery_context: string | null
  consent_attested_by: string | null
  consent_attested_at: string | null
  shopify_article_url: string | null
  created_at: string | null
  updated_at: string | null
}

/** Fetch a gallery post, verifying it belongs to the tenant and is a
 *  gallery. Returns null when missing/mismatched — callers 404. */
export async function getGallery(galleryId: string, tenantId: string): Promise<GalleryRow | null> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('blog_posts')
    .select(GALLERY_COLUMNS)
    .eq('id', galleryId)
    .eq('tenant_id', tenantId)
    .eq('content_type', 'gallery')
    .is('deleted_at', null)
    .single()
  if (error || !data) return null
  return data as unknown as GalleryRow
}

export function galleryImages(row: GalleryRow): GalleryImage[] {
  return Array.isArray(row.gallery_images) ? row.gallery_images : []
}

/** Persist a new gallery_images array (single-writer per gallery assumed —
 *  the client serialises registrations; the reconcile route is the
 *  belt-and-braces for anything that slips). */
export async function saveGalleryImages(galleryId: string, images: GalleryImage[]): Promise<string | null> {
  const db = createAdminClient()
  const { error } = await db
    .from('blog_posts')
    .update({
      gallery_images: images as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq('id', galleryId)
  return error ? error.message : null
}
