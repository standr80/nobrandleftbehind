// Bailey stage 6 — Clem writes the gallery page copy.
//
// ONE call produces: intro (2-3 short paragraphs following the same AEO
// chunk rules as posts/FAQs), a purpose-written meta description, tags
// (which drive Related-reading sibling matching), and the cluster
// classification (which drives the money-page pin at publish).
// Mirrors lib/clem/faq.ts + lib/clem/draft.ts conventions.

import { anthropic } from '@/lib/anthropic'
import { createAdminClient } from '@/lib/supabase/admin'
import type { GalleryRow } from './galleries'
import { galleryImages } from './galleries'

const CLAUDE_MODEL = 'claude-sonnet-4-6'

/** Clamp a meta description to ~160 chars at a word boundary. */
function clampMeta(s: string | undefined, max = 160): string {
  const t = (s ?? '').replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  const sp = cut.lastIndexOf(' ')
  return (sp > 40 ? cut.slice(0, sp) : cut).replace(/[\s.,;:!-]+$/, '')
}

interface Cluster {
  name?: string
  keywords?: string[]
}

export interface GalleryCopyResult {
  body_mdx: string
  meta_description: string
  tags: string[]
  cluster_id: string | null
}

export async function generateGalleryCopy(
  gallery: GalleryRow,
  tenantId: string,
): Promise<GalleryCopyResult> {
  const db = createAdminClient()
  const { data: tenant } = await db
    .from('tenants')
    .select('name, domain, brand_voice, target_audience, content_clusters')
    .eq('id', tenantId)
    .single()

  const clusters: Cluster[] = Array.isArray(tenant?.content_clusters)
    ? (tenant!.content_clusters as Cluster[]).filter((c) => c && typeof c.name === 'string' && c.name)
    : []
  const clusterNames = new Set(clusters.map((c) => c.name as string))

  const captions = galleryImages(gallery)
    .filter((i) => !i.hidden && i.status === 'ready')
    .sort((a, b) => a.order - b.order)
    .map((i, n) => `${n + 1}. ${i.caption ?? i.alt ?? '(no caption)'}`)
    .join('\n')

  const clusterInstruction = clusters.length
    ? `\n"cluster": choose the SINGLE best-fitting content cluster from this list and return its exact name (copy verbatim), or "" if none fit:\n${clusters
        .map((c) => `- ${c.name}${c.keywords?.length ? ` (keywords: ${c.keywords.join(', ')})` : ''}`)
        .join('\n')}`
    : '\n"cluster": always return ""'

  const prompt = [
    `You are writing the copy for a photo gallery page on the website of ${tenant?.name ?? 'the business'}${tenant?.domain ? ` (${tenant.domain})` : ''}.`,
    tenant?.brand_voice ? `Brand voice: ${tenant.brand_voice}` : null,
    tenant?.target_audience ? `Audience: ${tenant.target_audience}` : null,
    `Gallery title: "${gallery.title}"`,
    gallery.gallery_context ? `Event context from the uploader: ${gallery.gallery_context}` : null,
    `The gallery's image captions, in order:\n${captions || '(no captions yet)'}`,
    '',
    'Return ONLY a JSON object (no markdown fences) with these keys:',
    '"intro": an array of 2-3 short paragraphs (plain text, no markdown headers) introducing the gallery. CHUNK RULES (binding): answer-first — the opening sentence must say concretely what this gallery shows and for whom; name the subject explicitly in each paragraph opener (never start a paragraph with a pronoun); weave in real entities (brand, product, occasion, location); zero filler phrases ("welcome to", "feast your eyes", "look no further").',
    '"meta_description": ONE sentence, max 155 characters, purpose-written for search snippets — what the gallery shows + the commercial context.',
    '"tags": an array of 3-6 short lowercase topic tags (e.g. "wedding hire", "mini golf") for related-content matching.',
    clusterInstruction,
  ]
    .filter((l) => l !== null)
    .join('\n')

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1200,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = response.content
    .filter((b) => b.type === 'text')
    .map((b) => ('text' in b ? b.text : ''))
    .join('')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')

  let parsed: { intro?: string[]; meta_description?: string; tags?: string[]; cluster?: string }
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Copy generation returned invalid JSON — try again')
  }

  const paragraphs = (Array.isArray(parsed.intro) ? parsed.intro : [])
    .map((p) => String(p).trim())
    .filter(Boolean)
  if (!paragraphs.length) throw new Error('Copy generation returned no intro paragraphs')

  return {
    body_mdx: paragraphs.join('\n\n'),
    meta_description: clampMeta(parsed.meta_description),
    tags: (Array.isArray(parsed.tags) ? parsed.tags : [])
      .map((t) => String(t).toLowerCase().trim())
      .filter(Boolean)
      .slice(0, 6),
    cluster_id: clusterNames.has(parsed.cluster ?? '') ? (parsed.cluster as string) : null,
  }
}
