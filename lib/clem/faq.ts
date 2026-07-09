import { anthropic } from '@/lib/anthropic'
import { createAdminClient } from '../supabase/admin'
import { categoriesForDomain } from './categories'

const CLAUDE_MODEL = 'claude-sonnet-4-6'

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80)
}

/** Strip any 4-digit year from a slug so FAQ URLs stay evergreen. */
function stripYearFromSlug(slug: string): string {
  return slug
    .replace(/\b(19|20)\d{2}\b/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Clamp a meta description to ~160 chars at a word boundary (SEO snippet length). */
function clampMeta(s: string | undefined, max = 160): string {
  const t = (s ?? '').replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  const sp = cut.lastIndexOf(' ')
  return (sp > 40 ? cut.slice(0, sp) : cut).replace(/[\s.,;:!-]+$/, '')
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
  /** Build from a saved FAQ topic's assigned questions (verbatim answers bypass the model). */
  topicId?: string
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
  cluster?: string
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

  // Content clusters — classify this FAQ into one for hub-and-spoke linking.
  type Cluster = { name?: string; keywords?: string[] }
  const clusters: Cluster[] = Array.isArray(tenant.content_clusters)
    ? (tenant.content_clusters as Cluster[]).filter((c) => c && typeof c.name === 'string' && c.name)
    : []
  const clusterInstruction = clusters.length
    ? `\n\nContent cluster: choose the SINGLE best-fitting cluster for this FAQ and return its exact name in "cluster" (verbatim), or "" if none fit. Clusters:\n${clusters.map((c) => `- ${c.name}${c.keywords?.length ? ` (keywords: ${c.keywords.join(', ')})` : ''}`).join('\n')}`
    : ''
  const clusterNames = new Set(clusters.map((c) => c.name as string))

  // ── Gather candidate questions from all sources ──────────────────────────
  const questions: string[] = []
  const usedQuestionIds: string[] = []
  const preAnswered: FaqItem[] = []
  let topicRecord: { id: string; name: string } | null = null

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

  // A saved topic: use its assigned questions in order. Questions with a
  // verbatim answer bypass the model; unanswered ones are sent to Clem to write.
  if (input.topicId) {
    const { data: topic } = await db
      .from('faq_topics')
      .select('id, name')
      .eq('id', input.topicId)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (topic) {
      topicRecord = topic
      const { data: links } = await db
        .from('faq_topic_questions')
        .select('question_id, position')
        .eq('topic_id', input.topicId)
      const posById = new Map<string, number>(
        (links ?? []).map(
          (l: { question_id: string; position: number | null }) =>
            [l.question_id, l.position ?? 0] as [string, number],
        ),
      )
      const qids = [...posById.keys()]
      if (qids.length) {
        const { data: rows } = await db
          .from('faq_questions')
          .select('id, question, answer')
          .in('id', qids)
        const ordered = ((rows ?? []) as { id: string; question: string; answer: string | null }[])
          .slice()
          .sort((a, b) => (posById.get(a.id) ?? 0) - (posById.get(b.id) ?? 0))
        for (const r of ordered) {
          usedQuestionIds.push(r.id)
          if (r.answer && r.answer.trim()) preAnswered.push({ q: r.question, a: r.answer.trim() })
          else if (r.question) questions.push(r.question)
        }
      }
    }
  }

  // Scout PAA is a fallback source — never when building a specific topic.
  if ((input.includeScoutPaa ?? true) && !input.topicId) {
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

  // Need EITHER sourced questions/answers OR a topic/title to generate from.
  if (!finalQuestions.length && !preAnswered.length && !input.topic && !input.title && !topicRecord) {
    throw new Error('Provide a topic (or some questions) to build an FAQ page.')
  }

  const topicLabel = topicRecord?.name ?? input.topic ?? input.title ?? tenant.name
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
- Each answer must be self-contained and lead with a direct answer in the first sentence (snippet-friendly), 40–120 words
- NAME THE SUBJECT in the opening sentence of every answer — never start with a pronoun that refers back to the question or another answer (write "Band merch pricing depends on…", not "It depends on…"). Each answer must be fully understandable if lifted out on its own
- Where you can give a realistic, defensible figure (typical price ranges, margins, percentages), include it — concrete specifics earn AI citations — but never fabricate precise statistics you cannot support
- If an answer compares 3 or more options, present them as a small Markdown table rather than prose
- Do NOT end every answer with a call to action. At most 2–3 answers across the whole FAQ should include a contact/link CTA, and vary the wording; the rest should simply answer the question and stop
- No clichés, jargon, or filler${internalLinkingInstruction(tenant.internal_links)}

Return ONLY valid JSON, no commentary, matching this exact shape:
{
  "title": "FAQ page title — include the topic and the word FAQ or Questions where natural. Do NOT include the site, brand, or company name (it is added automatically elsewhere).",
  "slug": "url-slug (lowercase, hyphenated, EVERGREEN — no year or date)",
  "excerpt": "One-sentence summary under 160 chars",
  "metaDescription": "Purpose-built SEO meta description, 140–155 characters, leading with the primary keyword — NOT just the first sentence of the intro",
  "intro": "Optional 1-2 sentence intro paragraph",
  "cluster": "exact cluster name from the list, or empty string if none fit",
  "tags": ${categoriesForDomain(tenant.domain).length
    ? `[1–2 of these EXACT categories, copied verbatim, no new tags: ${categoriesForDomain(tenant.domain).join(', ')}]`
    : '["tag1", "tag2", "tag3"]'},
  "faq_items": [{ "q": "the question", "a": "the answer in markdown" }]
}${clusterInstruction}`,
    messages: [
      {
        role: 'user',
        content: `Build an FAQ page about: "${topicLabel}".${
          preAnswered.length
            ? `\n\n${preAnswered.length} Q&A(s) are ALREADY WRITTEN and will be included verbatim — do NOT rewrite, repeat, or re-answer these questions:\n${preAnswered.map((p) => `- ${p.q}`).join('\n')}`
            : ''
        }

${
  finalQuestions.length
    ? `Write clear, self-contained answers for EXACTLY these questions — do NOT add, invent, or pad with any extra questions (only merge obvious near-duplicates):
${finalQuestions.map((q) => `- ${q}`).join('\n')}

Return in "faq_items" ONLY these questions' answers — never the already-written ones.`
    : preAnswered.length
      ? `All Q&As for this page are already written above and will be included verbatim — do NOT add or invent any questions. Return "faq_items": [] and just provide the page metadata (title, slug, description, tags).`
      : `There are no questions yet, so generate the FAQ from scratch: write 8–12 genuinely common People-Also-Ask-style questions with answers, specific and relevant to ${tenant.name}, most-asked first.`
}`,
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

  const generatedItems: FaqItem[] = (gen.faq_items ?? [])
    .filter((it) => it && typeof it.q === 'string' && typeof it.a === 'string' && it.q.trim() && it.a.trim())
    .map((it) => ({ q: it.q.trim(), a: it.a.trim() }))
  // Verbatim (pre-written) answers first, then Clem's, de-duped by question.
  const faqItems: FaqItem[] = []
  const seenQ = new Set<string>()
  for (const it of [...preAnswered, ...generatedItems]) {
    const k = it.q.toLowerCase()
    if (seenQ.has(k)) continue
    seenQ.add(k)
    faqItems.push(it)
  }
  if (!faqItems.length) throw new Error('FAQ generation produced no valid Q&A pairs')

  const title = (gen.title || `${topicLabel} — Frequently Asked Questions`).trim()
  const baseSlug = stripYearFromSlug((gen.slug && generateSlug(gen.slug)) || generateSlug(title))

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
    `_Last updated: ${new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}_\n`,
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
      meta_description: clampMeta(gen.metaDescription) || null,
      tags,
      content_type: 'faq',
      cluster_id: clusterNames.has(gen.cluster ?? '') ? gen.cluster : null,
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

  // Topic: link it to the generated page + converge — remove its questions from
  // any OTHER topic so a question only ever lives on one FAQ page.
  if (topicRecord) {
    await db
      .from('faq_topics')
      .update({ generated_post_id: post.id, status: 'generated' })
      .eq('id', topicRecord.id)
    if (usedQuestionIds.length) {
      await db
        .from('faq_topic_questions')
        .delete()
        .neq('topic_id', topicRecord.id)
        .in('question_id', usedQuestionIds)
    }
  }

  console.log(`[clem/faq] Created FAQ post "${finalSlug}" (id: ${post.id}) with ${faqItems.length} Q&A`)
  return post.id
}

/**
 * Suggest candidate FAQ *questions* (not answers) for a topic and add the new
 * ones to the question bank (source 'clem', status 'open'), so the user can
 * curate them when Scout has no PAA to import. Returns the questions added.
 */
export async function suggestFaqQuestions(
  tenantId: string,
  topic: string,
  topicId?: string,
  count = 10,
): Promise<string[]> {
  const db = createAdminClient()
  const { data: tenant } = await db
    .from('tenants')
    .select('name, domain, target_audience')
    .eq('id', tenantId)
    .single()
  if (!tenant) throw new Error(`Tenant ${tenantId} not found`)

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system: `You generate candidate FAQ questions (NOT answers) for ${tenant.name} (${tenant.domain}). Return ONLY a JSON array of question strings — real, specific questions a ${tenant.target_audience ?? 'customer'} would type or ask (People-Also-Ask style). British English, no duplicates, no numbering.`,
    messages: [
      {
        role: 'user',
        content: `Suggest ${count} FAQ questions about: "${topic}". Return a JSON array of strings only, e.g. ["First question?", "Second question?"].`,
      },
    ],
  })

  const raw = response.content[0]?.type === 'text' ? response.content[0].text : ''
  let list: string[] = []
  try {
    const match = raw.match(/\[[\s\S]*\]/)
    const parsed = JSON.parse(match?.[0] ?? raw)
    if (Array.isArray(parsed)) list = parsed.filter((x): x is string => typeof x === 'string')
  } catch {
    throw new Error('Could not parse suggested questions from the model')
  }
  list = list.map((s) => s.trim()).filter(Boolean)
  if (!list.length) return []

  // Skip anything already in the bank (any status), and de-dupe the batch.
  const { data: existing } = await db
    .from('faq_questions')
    .select('question')
    .eq('tenant_id', tenantId)
  const seen = new Set(
    ((existing ?? []) as { question: string | null }[]).map((r) => (r.question ?? '').trim().toLowerCase()),
  )
  const fresh: string[] = []
  for (const q of list) {
    const k = q.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    fresh.push(q)
  }
  if (!fresh.length) return []

  const { data: inserted, error } = await db
    .from('faq_questions')
    .insert(
      fresh.map((question) => ({
        tenant_id: tenantId,
        question,
        source: 'clem',
        topic: topic || null,
        status: 'open',
      })),
    )
    .select('id')
  if (error) throw new Error(`Failed to save suggested questions: ${error.message}`)

  // If suggesting for a specific topic, assign the new questions to it.
  if (topicId && inserted?.length) {
    const { data: existingLinks } = await db
      .from('faq_topic_questions')
      .select('position')
      .eq('topic_id', topicId)
    let pos = ((existingLinks ?? []) as { position: number | null }[]).reduce(
      (m, r) => Math.max(m, r.position ?? 0),
      0,
    )
    await db.from('faq_topic_questions').insert(
      (inserted as { id: string }[]).map((r) => ({ topic_id: topicId, question_id: r.id, position: ++pos })),
    )
  }
  return fresh
}
