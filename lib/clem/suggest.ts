import Anthropic from '@anthropic-ai/sdk'
import { default as FirecrawlApp } from '@mendable/firecrawl-js'
import { createAdminClient } from '../supabase/admin'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const CLAUDE_MODEL = 'claude-sonnet-4-20250514'
const CRAWL_EXPIRY_DAYS = 7
const CRAWL_PAGE_LIMIT = 50
const MAX_CRAWL_CHARS = 120_000
const REF_CRAWL_PAGE_LIMIT = 20
const MAX_REF_CRAWL_CHARS = 60_000

export interface ReferenceSummary {
  url: string
  summary: string
  crawled_at: string
}

// ============================================================
// Site crawl — Firecrawl + Claude summarisation
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function crawlAndSummarise(tenant: Record<string, any>): Promise<string> {
  const db = createAdminClient()

  // Return cached crawl if still valid
  const { data: cache } = await db
    .from('site_crawl_cache')
    .select('*')
    .eq('tenant_id', tenant.id)
    .maybeSingle()

  if (cache?.expires_at && new Date(cache.expires_at) > new Date()) {
    console.log(`[clem/crawl] Using cached crawl for ${tenant.domain}`)
    return cache.summary ?? ''
  }

  console.log(`[clem/crawl] Crawling ${tenant.domain}…`)

  const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! })

  const crawlResponse = await firecrawl.crawl(`https://${tenant.domain}`, {
    limit: CRAWL_PAGE_LIMIT,
    scrapeOptions: { formats: ['markdown'] },
  })

  if (crawlResponse.status === 'failed' || crawlResponse.status === 'cancelled') {
    throw new Error(`Firecrawl crawl failed for ${tenant.domain} (status: ${crawlResponse.status})`)
  }

  const rawContent = (crawlResponse.data ?? [])
    .map((page) => `URL: ${page.metadata?.sourceURL ?? 'unknown'}\n\n${page.markdown ?? ''}`)
    .join('\n\n---\n\n')
    .slice(0, MAX_CRAWL_CHARS)

  // Ask Claude to synthesise the crawl into a structured summary
  const summaryMsg = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `Analyse this website content and return a JSON object with exactly these keys:
{
  "summary": "2-3 sentence overview of what this site is and who it serves",
  "brandVoice": "1-2 sentence description of the writing tone and style",
  "existingTopics": ["array", "of", "blog topic strings already covered"]
}

Website content:
${rawContent}`,
      },
    ],
  })

  const summaryText =
    summaryMsg.content[0].type === 'text' ? summaryMsg.content[0].text : ''

  let parsed: { summary: string; brandVoice: string; existingTopics: string[] } = {
    summary: summaryText,
    brandVoice: '',
    existingTopics: [],
  }

  try {
    const jsonMatch = summaryText.match(/\{[\s\S]*\}/)
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
  } catch {
    // Claude returned free text — use as-is for summary
  }

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + CRAWL_EXPIRY_DAYS)

  await db.from('site_crawl_cache').upsert(
    {
      tenant_id: tenant.id,
      crawled_at: new Date().toISOString(),
      page_count: crawlResponse.data?.length ?? 0,
      summary: parsed.summary,
      existing_topics: parsed.existingTopics,
      expires_at: expiresAt.toISOString(),
    },
    { onConflict: 'tenant_id' },
  )

  // Auto-populate brand_voice if the tenant hasn't set it manually
  if (!tenant.brand_voice && parsed.brandVoice) {
    await db.from('tenants').update({ brand_voice: parsed.brandVoice }).eq('id', tenant.id)
  }

  return parsed.summary
}

// ============================================================
// Public: run main site crawl only (manual re-crawl button)
// ============================================================

export async function runCrawl(tenantId: string): Promise<void> {
  const db = createAdminClient()
  const { data: tenant, error } = await db
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single()

  if (error || !tenant) throw new Error(`Tenant ${tenantId} not found`)

  // Force-expire the cache so crawlAndSummarise re-crawls
  await db
    .from('site_crawl_cache')
    .update({ expires_at: new Date(0).toISOString() })
    .eq('tenant_id', tenantId)

  await crawlAndSummarise(tenant)
}

// ============================================================
// Public: crawl a single reference (competitor) URL
// ============================================================

export async function runReferenceCrawl(tenantId: string, url: string): Promise<void> {
  const db = createAdminClient()

  // Normalise — ensure the URL has a scheme
  const normalisedUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`

  console.log(`[clem/ref-crawl] Crawling reference URL ${normalisedUrl}…`)

  const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! })

  const crawlResponse = await firecrawl.crawl(normalisedUrl, {
    limit: REF_CRAWL_PAGE_LIMIT,
    scrapeOptions: { formats: ['markdown'] },
  })

  if (crawlResponse.status === 'failed' || crawlResponse.status === 'cancelled') {
    throw new Error(`Firecrawl failed for ${normalisedUrl} (status: ${crawlResponse.status})`)
  }

  const rawContent = (crawlResponse.data ?? [])
    .map((page) => `URL: ${page.metadata?.sourceURL ?? 'unknown'}\n\n${page.markdown ?? ''}`)
    .join('\n\n---\n\n')
    .slice(0, MAX_REF_CRAWL_CHARS)

  const summaryMsg = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Analyse this competitor or reference website and return a JSON object with exactly these keys:
{
  "summary": "2-3 sentence overview: what they do, who they serve, what makes them distinctive",
  "topTopics": ["main topics and themes covered on this site"]
}

Website content:
${rawContent}`,
      },
    ],
  })

  const summaryText =
    summaryMsg.content[0].type === 'text' ? summaryMsg.content[0].text : ''

  let parsed: { summary: string; topTopics: string[] } = {
    summary: summaryText,
    topTopics: [],
  }

  try {
    const jsonMatch = summaryText.match(/\{[\s\S]*\}/)
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
  } catch {
    // use raw text as summary
  }

  // Merge into the existing reference_summaries array, replacing any prior entry for this URL
  const { data: cache } = await db
    .from('site_crawl_cache')
    .select('reference_summaries')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  const existing: ReferenceSummary[] = (cache?.reference_summaries as ReferenceSummary[]) ?? []
  const updated: ReferenceSummary[] = [
    ...existing.filter((r) => r.url !== url && r.url !== normalisedUrl),
    { url, summary: parsed.summary, crawled_at: new Date().toISOString() },
  ]

  if (cache) {
    await db
      .from('site_crawl_cache')
      .update({ reference_summaries: updated })
      .eq('tenant_id', tenantId)
  } else {
    // No main crawl row yet — create one so we can store the reference summary
    await db.from('site_crawl_cache').insert({
      tenant_id: tenantId,
      crawled_at: new Date().toISOString(),
      expires_at: new Date(0).toISOString(), // expired so main crawl still runs when needed
      reference_summaries: updated,
    })
  }
}

// ============================================================
// Public: generate topic suggestions
// ============================================================

export async function runSuggestions(tenantId: string): Promise<void> {
  const db = createAdminClient()

  const { data: tenant, error } = await db
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single()

  if (error || !tenant) throw new Error(`Tenant ${tenantId} not found`)

  const crawlSummary = await crawlAndSummarise(tenant)

  const { data: cache } = await db
    .from('site_crawl_cache')
    .select('existing_topics, reference_summaries')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  const existingTopics: string[] = cache?.existing_topics ?? []
  const referenceSummaries: ReferenceSummary[] = (cache?.reference_summaries as ReferenceSummary[]) ?? []

  // Build optional competitor context block
  const referenceContext =
    referenceSummaries.length > 0
      ? `\n\nCompetitor / reference sites (use for inspiration and gap analysis — do NOT reproduce their content):\n${referenceSummaries
          .map((r) => `- ${r.url}: ${r.summary}`)
          .join('\n')}`
      : ''

  console.log(`[clem/suggest] Generating suggestions for ${tenant.name}…`)

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system: `You are Clem, an expert content strategist working for ${tenant.name} (${tenant.domain}).
Brand voice: ${tenant.brand_voice ?? 'Professional and helpful'}
Target audience: ${tenant.target_audience ?? 'General audience'}
${tenant.forbidden_words?.length ? `Never use these words: ${tenant.forbidden_words.join(', ')}` : ''}

Always return valid JSON — no markdown fences, no commentary outside the JSON.`,
    messages: [
      {
        role: 'user',
        content: `Site overview: ${crawlSummary}${referenceContext}

Topics already covered (do NOT duplicate these): ${existingTopics.join(', ') || 'none yet'}

Suggest 5 original blog post ideas that:
- Are highly relevant to the target audience
- Have clear SEO value
- Are not duplicates of existing topics
- Match the brand voice
${referenceSummaries.length > 0 ? '- Where relevant, identify angles or gaps that distinguish this brand from the reference/competitor sites' : ''}

Return a JSON array of exactly 5 objects:
[
  {
    "proposed_title": "...",
    "rationale": "Why this will resonate with the audience and what problem it solves",
    "target_keywords": ["primary keyword", "secondary keyword", "long-tail keyword"]
  }
]`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  let suggestions: Array<{
    proposed_title: string
    rationale: string
    target_keywords: string[]
  }> = []

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (jsonMatch) suggestions = JSON.parse(jsonMatch[0])
  } catch {
    throw new Error(`Failed to parse Claude suggestions response: ${text.slice(0, 500)}`)
  }

  if (!suggestions.length) throw new Error('Claude returned 0 suggestions')

  const { error: insertError } = await db.from('suggestions').insert(
    suggestions.map((s) => ({
      tenant_id: tenantId,
      proposed_title: s.proposed_title,
      rationale: s.rationale,
      target_keywords: s.target_keywords,
      status: 'pending' as const,
    })),
  )

  if (insertError) throw new Error(`Failed to insert suggestions: ${insertError.message}`)

  console.log(`[clem/suggest] Inserted ${suggestions.length} suggestions for ${tenant.name}`)
}
