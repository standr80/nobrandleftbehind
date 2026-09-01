// Bailey stage 4 — vision enrichment. ONE Claude call per image producing:
//   alt           — one sentence, literal visual description, entities woven in
//   caption       — one line of context NOT visible in the image
//   filename_slug — 4-8 word kebab-case descriptive slug
//
// The prompt context (brand, gallery title, event context, cluster) is the
// single biggest quality lever — always include what we have.
//
// This is also the Phase-1 descriptive-filename write: the master gets a NEW
// slug-named object (copy + remove old) — variants are transform URLs on the
// new path, so nothing else needs rewriting.

import sharp from 'sharp'
import { anthropic } from '@/lib/anthropic'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  GALLERY_BUCKET,
  MASTER_WEBP_QUALITY,
  TRANSFORM_THUMB_WIDTH,
  USE_TRANSFORM_URLS,
  galleryPublicUrl,
  galleryTransformUrl,
  type GalleryImage,
} from './constants'
import type { GalleryRow } from './galleries'
import { patchGalleryImage } from './process'

/** Sonnet-class for caption quality; drop to a Haiku-class string if cost
 *  warrants at scale (mirrors lib/clem/faq.ts). */
const BAILEY_VISION_MODEL = 'claude-sonnet-4-6'

/** Cheap model for the binary upside-down check. */
const ORIENTATION_MODEL = 'claude-haiku-4-5'

/** 180° backstop. Open-ended "what rotation?" prompting is unreliable for
 *  upside-down images (correct aspect ratio, plausible composition), but an
 *  A/B comparison against the flipped twin is a much easier judgement. Only
 *  called when the main pass answered 0. Fails safe: any error → false. */
async function looksUpsideDown(masterBuffer: Buffer): Promise<boolean> {
  try {
    const small = await sharp(masterBuffer)
      .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer()
    const flipped = await sharp(small).rotate(180).jpeg({ quality: 70 }).toBuffer()

    const response = await anthropic.messages.create({
      model: ORIENTATION_MODEL,
      max_tokens: 10,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Image A:' },
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: small.toString('base64') },
            },
            { type: 'text', text: 'Image B:' },
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: flipped.toString('base64') },
            },
            {
              type: 'text',
              text: 'Image B is Image A rotated 180 degrees, so exactly one of them is upright. Judge by gravity: heads above bodies, sky/ceiling at the top, objects resting on surfaces, readable text. Reply with ONLY the single letter A or B — whichever image is correctly oriented.',
            },
          ],
        },
      ],
    })
    const answer = response.content
      .filter((b) => b.type === 'text')
      .map((b) => ('text' in b ? b.text : ''))
      .join('')
      .trim()
      .toUpperCase()
    return answer.startsWith('B')
  } catch {
    return false
  }
}

export interface TenantEnrichContext {
  brandName: string
  domain: string | null
  targetAudience: string | null
}

export async function getTenantEnrichContext(tenantId: string): Promise<TenantEnrichContext> {
  const db = createAdminClient()
  const { data } = await db
    .from('tenants')
    .select('name, domain, target_audience')
    .eq('id', tenantId)
    .single()
  return {
    brandName: data?.name ?? 'the business',
    domain: data?.domain ?? null,
    targetAudience: data?.target_audience ?? null,
  }
}

function kebab(text: string, maxWords = 8): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, maxWords)
    .join('-')
    .slice(0, 60)
}

interface EnrichmentResult {
  alt: string
  caption: string
  filename_slug: string
  rotation?: number
}

function buildPrompt(gallery: GalleryRow, ctx: TenantEnrichContext): string {
  const lines = [
    `You are writing image SEO metadata for a photo gallery page on the website of ${ctx.brandName}${ctx.domain ? ` (${ctx.domain})` : ''}.`,
    ctx.targetAudience ? `Their audience: ${ctx.targetAudience}.` : null,
    `Gallery title: "${gallery.title}".`,
    gallery.gallery_context ? `Event context supplied by the uploader: ${gallery.gallery_context}.` : null,
    gallery.cluster_id ? `This gallery belongs to the "${gallery.cluster_id}" content cluster.` : null,
    '',
    'Look at the image and return ONLY a JSON object (no markdown fences, no commentary) with exactly these keys:',
    '- "alt": ONE sentence, a literal, accessibility-first description of what is visibly IN the image, weaving in relevant entities (brand, product, occasion, location) naturally. No "image of"/"photo of" prefix.',
    '- "caption": ONE short line adding context NOT visible in the image (occasion, product name, venue, location). It must not duplicate the alt — they do different jobs.',
    '- "filename_slug": a 4-8 word kebab-case descriptive slug for the image file (lowercase, hyphens, no dates).',
    '- "rotation": the CLOCKWISE rotation in degrees (0, 90, 180, or 270) needed to make the image upright and correctly oriented. Use 0 only if it is already correct. Judge from content: people, horizons, text, buildings. Check the 180 case deliberately — an upside-down image has the correct aspect ratio, so ask yourself: are faces/heads at the bottom, is the sky or ceiling at the bottom, is any text inverted? If so, answer 180.',
  ]
  return lines.filter((l) => l !== null).join('\n')
}

/** Enrich one image (must have a processed master) and persist: alt,
 *  caption, slug-named master, status ready. Returns the patch applied. */
/**
 * Which images a "regenerate captions" run should rewrite.
 *
 * Excluded:
 *  - hidden images (parked, and not on the published page)
 *  - anything without a processed master, or mid-pipeline — reconcile's job
 *  - images a human has edited, unless overwriteEdited is set. This is the
 *    guarantee that a re-run cannot silently discard someone's own wording.
 */
export function selectReenrichTargets(
  images: GalleryImage[],
  overwriteEdited: boolean,
): { targets: GalleryImage[]; skippedEdited: number } {
  const candidates = images.filter(
    (i) => !i.hidden && !!i.master_path && (i.status === 'ready' || i.status === 'processed'),
  )
  const targets = overwriteEdited ? candidates : candidates.filter((i) => !i.edited)
  return { targets, skippedEdited: candidates.length - targets.length }
}

export async function enrichImage(
  gallery: GalleryRow,
  image: GalleryImage,
  ctx: TenantEnrichContext,
): Promise<Partial<GalleryImage>> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const db = createAdminClient()
  try {
    if (!image.master_path || !image.url) {
      throw new Error('Image has no processed master — run processing first')
    }

    const response = await anthropic.messages.create({
      model: BAILEY_VISION_MODEL,
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'url', url: image.url } },
            { type: 'text', text: buildPrompt(gallery, ctx) },
          ],
        },
      ],
    })

    const raw = response.content
      .filter((b) => b.type === 'text')
      .map((b) => ('text' in b ? b.text : ''))
      .join('')
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')

    let parsed: EnrichmentResult
    try {
      parsed = JSON.parse(raw) as EnrichmentResult
    } catch {
      throw new Error('Vision response was not valid JSON')
    }
    const alt = String(parsed.alt ?? '').trim()
    const caption = String(parsed.caption ?? '').trim()
    const slug = kebab(String(parsed.filename_slug ?? ''))
    if (!alt || !caption) throw new Error('Vision response missing alt or caption')

    const patch: Partial<GalleryImage> = {
      alt,
      caption,
      filename_slug: slug || null,
      status: 'ready',
      error: null,
    }

    // Vision orientation backstop: EXIF auto-orient (processing) covers
    // phone photos, but pixel-rotated images with no EXIF can only be
    // caught by looking. If the model says the image isn't upright,
    // physically rotate the master.
    let rotation = [90, 180, 270].includes(Number(parsed.rotation)) ? Number(parsed.rotation) : 0
    if (rotation === 0) {
      const { data: masterBlob } = await db.storage
        .from(GALLERY_BUCKET)
        .download(image.master_path)
      if (masterBlob && (await looksUpsideDown(Buffer.from(await masterBlob.arrayBuffer())))) {
        rotation = 180
      }
    }

    // Descriptive filename: the slug-named master is a NEW write, then the
    // anonymous one is removed. Source objects keep random keys.
    const dir = image.master_path.slice(0, image.master_path.lastIndexOf('/'))
    const sourceKey = image.storage_path.split('/').pop()!.replace(/\.[^.]+$/, '')
    const namedPath =
      slug && !image.master_path.includes(`-${slug}.`)
        ? `${dir}/${sourceKey}-${slug}.webp`
        : image.master_path

    if (rotation !== 0) {
      // Rotate + (re)name in one write.
      const { data: blob, error: dlErr } = await db.storage
        .from(GALLERY_BUCKET)
        .download(image.master_path)
      if (dlErr || !blob) throw new Error(dlErr?.message ?? 'Could not download master for rotation')
      const rotated = await sharp(Buffer.from(await blob.arrayBuffer()))
        .rotate(rotation)
        .webp({ quality: MASTER_WEBP_QUALITY })
        .toBuffer({ resolveWithObject: true })
      const { error: upErr } = await db.storage
        .from(GALLERY_BUCKET)
        .upload(namedPath, rotated.data, { contentType: 'image/webp', upsert: true })
      if (upErr) throw new Error(`Could not write rotated master: ${upErr.message}`)
      patch.width = rotated.info.width
      patch.height = rotated.info.height
    } else if (namedPath !== image.master_path) {
      const { error: copyErr } = await db.storage
        .from(GALLERY_BUCKET)
        .copy(image.master_path, namedPath)
      if (copyErr && !/already exists/i.test(copyErr.message)) {
        throw new Error(`Could not write named master: ${copyErr.message}`)
      }
    }

    if (namedPath !== image.master_path) {
      await db.storage.from(GALLERY_BUCKET).remove([image.master_path]).catch(() => {})
    }
    if (namedPath !== image.master_path || rotation !== 0) {
      patch.master_path = namedPath
      patch.url = galleryPublicUrl(supabaseUrl, namedPath)
      patch.thumb_url = USE_TRANSFORM_URLS
        ? galleryTransformUrl(supabaseUrl, namedPath, TRANSFORM_THUMB_WIDTH)
        : image.thumb_url
    }

    const saveError = await patchGalleryImage(gallery.id, image.id, patch)
    if (saveError) throw new Error(saveError)
    return patch
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Enrichment failed'
    const patch: Partial<GalleryImage> = { status: 'failed', error: message }
    await patchGalleryImage(gallery.id, image.id, patch)
    return patch
  }
}
