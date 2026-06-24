import { anthropic } from '@/lib/anthropic'
import { createAdminClient } from '../supabase/admin'

const CLAUDE_MODEL = 'claude-sonnet-4-6'

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80)
}

export interface FaqDraftInput {
  /** Topic/theme for the FAQ page; seeds title + slug when none supplied. */
  topic?: string
  /** Explicit page title (otherwise derived from topic). */
  title?: string
  /** Ad-hoc question strings to include. */
  questions?: string[]
  /** Ids from faq_questions to include (marked 'used' on success). */
  questionIds?: string[]
  /** Pull PAA/gap questions from Scout opportunities (default true). */
  includeScoutPaa?: boolean
  /** Cap on total questions sent to the model (default 12). */
  maxQuestions?: number
  /** Optional suggestion this FAQ was generated from. */
  suggestionId?: string
}

interface FaqItem {
  q: string
  a: string
}

interface FaqGeneration {
  title: string
  slug?: string
  excerpt?: string
  metaDescription?: string
  intro?: string
  tags?: string[]
  faq_items: FaqItem[]
}

type LinkItem = { url?: string; label?: string; description?: string; must_link?: boolean }

/** Internal-linking instruction block, mirroring lib/clem/draft.ts. */
function internalLinkingInstruction(internalLinks: unknown): string {
  const linkMap: LinkItem[] = Array.isArray(internalLinks)
    ? (internalLinks as LinkItem[]).filter((l) => l && typeof l.url === 'string' && l.url)
    : []
  if (!linkMap.length) return ''
  const mustLink = linkMap.filter((l) => l.must_link)
  return `

Internal linking (IMPORTANT — for SEO and to turn readers into enquiries):
- Weave 1–3 contextually relevant internal links into the answers, using descriptive anchor text (never "click here").
- Link ONLY to pages in the list below. Do NOT invent, guess, or link to any URL that is not listed.
${mustLink.length ? `- ALWAYS include a link to: ${mustLink.map((l) => l.url).join(', ')}.` : ''}
- Use standard Markdown links: [anchor text](url).

Available pages to link to:
${linkMap.map((l) => `- ${l.url}${l.label ? ` — ${l.label}` : ''}${l.description ? `: ${l.description}` : ''}${l.must_link ? ' [MUST LINK]' : ''}`).join('\n')}`
}

// ============================================================
// Public: assemble selected questions into an FAQ page draft.
// Mirrors lib/clem/draft.ts but outputs structured Q&A + FAQPage-ready
// faq_items, stored as content_type='faq'.
// ============================================================

export async function runFaqDraft(tenantId: string, input: FaqDraftInput): Promise<string> {
  const db = createAdminClient()

  const { data: tenant, error: tenantErr } = await db
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single()
  if (tenantErr || !tenant) throw new Error(`Tenant ${tenantId} not found`)

  const maxQuestions = input.maxQuestions ?? 12

  // ── Gather candidate questions from all sources ──────────────────────────
  const questions: string[] = []
  const usedQuestionIds: string[] = []

  if (input.questions?.length) questions.push(...input.questions)

  if (input.questionIds?.length) {
    const { data: rows } = await db
      .from('faq_questions')
      .select('id, question')
      .eq('tenant_id', tenantId)
      .in('id', input.questionIds)
    for (const r of rows ?? []) {
      if (r.question) {
        questions.push(r.question)
        usedQuestionIds.push(r.id)
      }
    }
  }

  if (input.includeScoutPaa ?? true) {
    let q = db
      .from('scout_keyword_opportunities')
      .select('keyword')
      .eq('tenant_id', tenantId)
      .in('opportunity_type', ['paa', 'gap'])
      .limit(maxQuestions)
    if (input.topic) q = q.ilike('keyword', `%${input.topic}%`)
    const { data: opps } = await q
    for (const o of opps ?? []) if (o.keyword) questions.push(o.keyword)
  }

  // De-duplicate (case-insensitive) and cap.
  const seen = new Set<string>()
  const finalQuestions = questions
    .map((s) => s.trim())
    .filter((s) => {
      const k = s.toLowerCase()
      if (!s || seen.has(k)) return false
      seen.add(k)
      return true
    })
    .slice(0, maxQuestions)

  if (!finalQuestions.length) {
    throw new Error('No questions available to build an FAQ page. Add questions or run Scout first.')
  }

  const topicLabel = input.topic ?? input.title ?? tenant.name
  const today = new Date().toISOString().split('T')[0]

  // ── Generate the FAQ as JSON ─────────────────────────────────────────────
  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4000,
    system: `You are Clem, a content writer for ${tenant.name} (${tenant.domain}).

Writing guidelines:
- Brand voice: ${tenant.brand_voice ?? 'Professional, helpful, and clear'}
- Target audience: ${tenant.target_audience ?? 'General audience'}
${tenant.forbidden_words?.length ? `- NEVER use these words or phrases: ${tenant.forbidden_words.join(', ')}` : ''}
- Write in British English
- Each answer must be self-contained and directly answer the question (snippet-friendly), 40–120 words
- Be specific, factual and practical. Do NOT invent statistics, prices, or claims you cannot support
- No clichés, jargon, or filler${internalLinkingInstruction(tenant.internal_links)}

Return ONLY valid JSON, no commentary, matching this exact shape:
{
  "title": "FAQ page title — include the topic and the word FAQ or Questions where natural. Do NOT include the site, brand, or company name (it is added automatically elsewhere).",
  "slug": "url-slug",
  "excerpt": "One-sentence summary under 160 chars",
  "metaDescription": "SEO meta description under 160 chars",
  "intro": "Optional 1-2 sentence intro paragraph",
  "tags": ["tag1", "tag2", "tag3"],
  "faq_items": [{ "q": "the question", "a": "the answer in markdown" }]
}`,
    messages: [
      {
        role: 'user',
        content: `Build an FAQ page about: "${topicLabel}".

Base it on these real questions (merge near-duplicates, keep the clearest wording, drop anything off-topic or not relevant to ${tenant.name}):
${finalQuestions.map((q) => `- ${q}`).join('\n')}

Aim for ${Math.min(finalQuestions.length, 10)} high-quality Q&A pairs.`,
      },
    ],
  })

  const raw = response.content[0]?.type === 'text' ? response.content[0].text : ''
  if (!raw) throw new Error('Claude returned empty content for FAQ draft')

  let gen: FaqGeneration
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    gen = JSON.parse(jsonMatch?.[0] ?? raw)
  } catch {
    throw new Error('Could not parse FAQ JSON from model output')
  }

  const faqItems: FaqItem[] = (gen.faq_items ?? [])
    .filter((it) => it && typeof it.q === 'string' && typeof it.a === 'string' && it.q.trim() && it.a.trim())
    .map((it) => ({ q: it.q.trim(), a: it.a.trim() }))
  if (!faqItems.length) throw new Error('FAQ generation produced no valid Q&A pairs')

  const title = (gen.title || `${topicLabel} — Frequently Asked Questions`).trim()
  const baseSlug = (gen.slug && generateSlug(gen.slug)) || generateSlug(title)

  // Unique slug per tenant.
  const { data: existing } = await db
    .from('blog_posts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('slug', baseSlug)
    .maybeSingle()
  const finalSlug = existing ? `${baseSlug}-${Date.now()}` : baseSlug

  const tags = Array.isArray(gen.tags) ? gen.tags.filter((t) => typeof t === 'string') : []

  // body_mdx renders the page everywhere via the existing toHtml pipeline;
  // faq_items is the source of truth for FAQPage schema.
  const bodyMdx = [
    '---',
    `title: "${title.replace(/"/g, "'")}"`,
    `slug: "${finalSlug}"`,
    `date: "${today}"`,
    gen.excerpt ? `excerpt: "${gen.excerpt.replace(/"/g, "'")}"` : '',
    gen.metaDescription ? `metaDescription: "${gen.metaDescription.replace(/"/g, "'")}"` : '',
    `tags: ${JSON.stringify(tags)}`,
    'author: "Clem"',
    'contentType: "faq"',
    'status: "draft"',
    '---',
    '',
    gen.intro ? `${gen.intro.trim()}\n` : '',
    faqItems.map((it) => `## ${it.q}\n\n${it.a}`).join('\n\n'),
  ]
    .filter((line) => line !== '')
    .join('\n')

  const { data: post, error: insertError } = await db
    .from('blog_posts')
    .insert({
      tenant_id: tenantId,
      suggestion_id: input.suggestionId ?? null,
      title,
      slug: finalSlug,
      body_mdx: bodyMdx,
      excerpt: gen.excerpt ?? null,
      meta_description: gen.metaDescription ?? null,
      tags,
      content_type: 'faq',
      faq_items: faqItems as unknown as import('@/lib/supabase/types').Json,
      origin: 'clem',
      status: 'draft',
      drafted_at: new Date().toISOString(),
      created_by: 'clem',
    })
    .select('id')
    .single()

  if (insertError) throw new Error(`Failed to insert FAQ post: ${insertError.message}`)

  // Mark sourced questions used so they aren't reused.
  if (usedQuestionIds.length) {
    await db
      .from('faq_questions')
      .update({ status: 'used', used_in_post_id: post.id })
      .in('id', usedQuestionIds)
  }

  console.log(`[clem/faq] Created FAQ post "${finalSlug}" (id: ${post.id}) with ${faqItems.length} Q&A`)
  return post.id
}
