import Anthropic from '@anthropic-ai/sdk'
import sharp from 'sharp'
import { createAdminClient } from '../supabase/admin'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const CLAUDE_MODEL = 'claude-sonnet-4-20250514'
const BUCKET = 'hero-images'

// Target: 1600×700 JPEG, ≤500 KB
const TARGET_WIDTH = 1600
const TARGET_HEIGHT = 700
const JPEG_QUALITY = 85

export interface GeneratedImage {
  ideogramUrl: string
  supabaseUrl: string
}

export interface HeroImageResult {
  prompt: string
  images: GeneratedImage[]
}

/**
 * Generate an Ideogram-optimised image prompt for the given post using Claude,
 * then call the Ideogram V3 API to produce 2 images. Each PNG is fetched,
 * resized to 1600×700, converted to JPEG, and stored in Supabase Storage.
 *
 * @param tenantId   Tenant to look up Ideogram key and brand context
 * @param postId     Post record to store images under
 * @param customPrompt  If supplied, skip the Claude step and use this prompt directly
 */
export async function generateHeroImage(
  tenantId: string,
  postId: string,
  customPrompt?: string,
): Promise<HeroImageResult> {
  const db = createAdminClient()

  // ── Fetch tenant + post ───────────────────────────────────────────────────
  const [{ data: tenant }, { data: post }] = await Promise.all([
    db.from('tenants')
      .select('name, domain, brand_voice, ideogram_api_key, image_gen_enabled')
      .eq('id', tenantId)
      .single(),
    db.from('blog_posts')
      .select('title, excerpt')
      .eq('id', postId)
      .eq('tenant_id', tenantId)
      .single(),
  ])

  if (!tenant) throw new Error('Tenant not found')
  if (!tenant.image_gen_enabled) throw new Error('Image generation is not enabled for this workspace')
  if (!tenant.ideogram_api_key) throw new Error('No Ideogram API key configured for this workspace')
  if (!post) throw new Error('Post not found')

  // ── Build / use prompt ────────────────────────────────────────────────────
  let prompt = customPrompt?.trim() ?? ''

  if (!prompt) {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 300,
      system: `You are an expert at writing prompts for AI image generators. 
Generate a concise, vivid image prompt for a blog hero image. 
Rules: photographic or illustration style, landscape orientation, NO text or words in the image, 
no people's faces unless absolutely central to the topic, avoid clichés. 
Return ONLY the prompt text — no explanation, no preamble.`,
      messages: [
        {
          role: 'user',
          content: `Blog title: "${post.title}"
Excerpt: ${post.excerpt ?? '(none)'}
Brand: ${tenant.name} — ${tenant.brand_voice ?? 'professional'}

Write an Ideogram hero image prompt (1–3 sentences).`,
        },
      ],
    })
    prompt = response.content[0].type === 'text' ? response.content[0].text.trim() : post.title
  }

  // ── Call Ideogram V3 API ──────────────────────────────────────────────────
  const ideogramRes = await fetch('https://api.ideogram.ai/v1/ideogram-v3/generate', {
    method: 'POST',
    headers: {
      'Api-Key': tenant.ideogram_api_key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      num_images: 2,
      aspect_ratio: '16x9',
      rendering_speed: 'QUALITY',
    }),
  })

  if (!ideogramRes.ok) {
    const errBody = await ideogramRes.text()
    throw new Error(`Ideogram API error ${ideogramRes.status}: ${errBody}`)
  }

  const ideogramData = await ideogramRes.json() as {
    data: Array<{ url: string }>
  }

  if (!ideogramData.data?.length) {
    throw new Error('Ideogram returned no images')
  }

  // ── Ensure bucket exists ──────────────────────────────────────────────────
  await db.storage.createBucket(BUCKET, { public: true }).catch(() => {})

  // ── Fetch, convert, upload each image ────────────────────────────────────
  const images: GeneratedImage[] = await Promise.all(
    ideogramData.data.map(async (img, idx) => {
      const imgRes = await fetch(img.url)
      if (!imgRes.ok) throw new Error(`Failed to fetch image ${idx}: ${imgRes.status}`)

      const rawBuffer = Buffer.from(await imgRes.arrayBuffer())

      const jpegBuffer = await sharp(rawBuffer)
        .resize(TARGET_WIDTH, TARGET_HEIGHT, { fit: 'cover', position: 'centre' })
        .jpeg({ quality: JPEG_QUALITY })
        .toBuffer()

      const path = `${tenantId}/${postId}-ai-${idx + 1}-${Date.now()}.jpg`

      const { error: uploadErr } = await db.storage
        .from(BUCKET)
        .upload(path, jpegBuffer, { contentType: 'image/jpeg', upsert: true })

      if (uploadErr) throw new Error(`Supabase upload error: ${uploadErr.message}`)

      const { data: urlData } = db.storage.from(BUCKET).getPublicUrl(path)

      return { ideogramUrl: img.url, supabaseUrl: urlData.publicUrl }
    }),
  )

  return { prompt, images }
}
