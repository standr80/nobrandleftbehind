import { anthropic } from '@/lib/anthropic'
import { createAdminClient } from '../supabase/admin'
import { stripWrappingFence } from '../mdx/toHtml'
import { categoriesForDomain } from './categories'

const CLAUDE_MODEL = 'claude-sonnet-4-6'

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80)
}

/**
 * Strip any 4-digit year (19xx/20xx) from a slug so URLs stay evergreen — a
 * yearless slug survives an annual title refresh without needing a redirect.
 */
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

function parseFrontmatter(mdx: string): Record<string, string> {
  const match = mdx.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  const result: Record<string, string> = {}
  match[1].split('\n').forEach((line) => {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) return
    const key = line.slice(0, colonIdx).trim()
    const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '')
    result[key] = value
  })
  return result
}

// ============================================================
// Public: research and write a full MDX blog post draft
// Triggered when a suggestion is accepted.
// ============================================================

export async function runDraft(tenantId: string, suggestionId: string): Promise<string> {
  const db = createAdminClient()

  const { data: tenant, error: tenantErr } = await db
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single()

  if (tenantErr || !tenant) throw new Error(`Tenant ${tenantId} not found`)

  const { data: suggestion, error: suggErr } = await db
    .from('suggestions')
    .select('*')
    .eq('id', suggestionId)
    .eq('tenant_id', tenantId)
    .single()

  if (suggErr || !suggestion) throw new Error(`Suggestion ${suggestionId} not found`)

  // Mark suggestion as accepted before drafting
  await db.from('suggestions').update({ status: 'accepted' }).eq('id', suggestionId)

  console.log(`[clem/draft] Writing "${suggestion.proposed_title}" for ${tenant.name}…`)

  const today = new Date().toISOString().split('T')[0]
  const currentYear = new Date().getFullYear()

  // Internal link map: the host site's key pages Clem may link to. Clem links
  // ONLY to these (never invents a URL) and always includes any must-link page.
  type LinkItem = { url?: string; label?: string; description?: string; must_link?: boolean }
  const linkMap: LinkItem[] = Array.isArray(tenant.internal_links)
    ? (tenant.internal_links as LinkItem[]).filter((l) => l && typeof l.url === 'string' && l.url)
    : []
  const mustLink = linkMap.filter((l) => l.must_link)
  const internalLinkingInstruction = linkMap.length
    ? `

Internal linking (IMPORTANT — for SEO and to turn readers into enquiries):
- Include 2–4 contextually relevant internal links in the body, woven naturally into sentences with descriptive anchor text (never "click here").
- Link ONLY to pages in the list below. Do NOT invent, guess, or link to any URL that is not listed.
${mustLink.length ? `- ALWAYS include a link to: ${mustLink.map((l) => l.url).join(', ')}.` : ''}
- Use standard Markdown links: [anchor text](url).

Available pages to link to:
${linkMap.map((l) => `- ${l.url}${l.label ? ` — ${l.label}` : ''}${l.description ? `: ${l.description}` : ''}${l.must_link ? ' [MUST LINK]' : ''}`).join('\n')}`
    : ''

  // Content clusters — classify the post into one so it can be hub-and-spoke
  // linked to the cluster's commercial page at publish time.
  type Cluster = { name?: string; keywords?: string[] }
  const clusters: Cluster[] = Array.isArray(tenant.content_clusters)
    ? (tenant.content_clusters as Cluster[]).filter((c) => c && typeof c.name === 'string' && c.name)
    : []
  const clusterInstruction = clusters.length
    ? `

Content cluster: choose the SINGLE best-fitting cluster for this post from the list below and return its exact name in the "cluster" field (copy verbatim). If none fit, use "". Clusters:
${clusters.map((c) => `- ${c.name}${c.keywords?.length ? ` (keywords: ${c.keywords.join(', ')})` : ''}`).join('\n')}`
    : ''
  const clusterNames = new Set(clusters.map((c) => c.name as string))

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 8192,
    system: `You are Clem, a skilled content writer working for ${tenant.name} (${tenant.domain}).

Writing guidelines:
- Brand voice: ${tenant.brand_voice ?? 'Professional, helpful, and clear'}
- Target audience: ${tenant.target_audience ?? 'General audience'}
${tenant.forbidden_words?.length ? `- NEVER use these words or phrases: ${tenant.forbidden_words.join(', ')}` : ''}
- Write in British English
- Avoid clichés, jargon, and filler phrases
- Use short paragraphs and clear headings
- Be specific and practical — give real value

You must return a complete MDX blog post. No commentary before or after. Start with --- and end with the last line of the post body.`,
    messages: [
      {
        role: 'user',
        content: `Write a complete blog post for the title: "${suggestion.proposed_title}"

Target SEO keywords: ${suggestion.target_keywords?.join(', ') ?? 'none specified'}
Editorial rationale: ${suggestion.rationale ?? ''}

Requirements:
- 900–1200 words of body content
- Engaging introduction that hooks the reader
- 3–4 sections with clear H2 headings
- Practical, actionable content throughout
- Natural keyword integration (never forced)
- Strong conclusion with a clear takeaway
- Evergreen content: do NOT put a year in the slug. Prefer timeless phrasing over specific years. If you must reference "now", use ${currentYear} and use it consistently — the title and body must never disagree on the year.
- Where it strengthens a claim, include a concrete, realistic data point or figure (e.g. typical margins, price ranges, percentages) rather than only general advice — specifics earn citations.
- ANSWER-FIRST: open every H2 section with a 1–2 sentence direct answer or key takeaway BEFORE elaborating, so the passage stands alone if quoted out of context.
- NAME THE SUBJECT at the start of each section and paragraph — never open with an ambiguous pronoun (It / This / They / These) whose referent lives in another section. Each section must be fully understandable in isolation (write "Enamel pins are…", not "These are…").
- COMPARISONS AS TABLES: when comparing 3 or more options (products, methods, tiers), present them as a Markdown table (e.g. columns Option | Typical price | Best for) rather than prose — tables get extracted and cited far more often.
- OUTBOUND CITATIONS: include 1–2 links to genuinely authoritative external sources (industry data, ONS, official platform docs) where they support a factual claim. Do not invent URLs — only link sources you are confident exist.${internalLinkingInstruction}${clusterInstruction}${
          categoriesForDomain(tenant.domain).length
            ? `\n- For "tags", choose 1–2 of these EXACT categories (copy the wording verbatim, do NOT invent new tags): ${categoriesForDomain(tenant.domain).join(', ')}`
            : ''
        }

Return the post as valid MDX with this exact frontmatter format:
---
title: "Post title here"
slug: "url-slug-here (lowercase, hyphenated, EVERGREEN — no year or date)"
date: "${today}"
excerpt: "One or two sentence summary for listing pages (under 160 chars)."
metaDescription: "Purpose-built SEO meta description, 140–155 characters, leads with the primary keyword and gives a compelling reason to click. NOT just the first sentence of the post."
tags: ["tag1", "tag2", "tag3"]
cluster: "exact cluster name from the list above, or empty string if none fit"
author: "Clem"
status: "draft"
---

[Post body in MDX — use ## for H2 headings, **bold**, *italic*, etc.]`,
      },
    ],
  })

  const rawContent = response.content[0].type === 'text' ? response.content[0].text : ''

  if (!rawContent) throw new Error('Claude returned empty content for draft')

  // Sanitise: unwrap a whole-document code fence and drop any commentary
  // the model added before the frontmatter, so body_mdx always starts at ---.
  let mdxContent = stripWrappingFence(rawContent)
  const fmStart = mdxContent.indexOf('---')
  if (fmStart > 0) mdxContent = mdxContent.slice(fmStart)

  const fm = parseFrontmatter(mdxContent)
  // Normalise + strip any year so the slug is evergreen, whatever the model returned.
  const slug = stripYearFromSlug(generateSlug(fm.slug || suggestion.proposed_title))

  // Handle duplicate slugs by appending a timestamp
  const { data: existing } = await db
    .from('blog_posts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('slug', slug)
    .maybeSingle()

  const finalSlug = existing ? `${slug}-${Date.now()}` : slug

  let tags: string[] = []
  try {
    if (fm.tags) tags = JSON.parse(fm.tags.replace(/'/g, '"'))
  } catch {
    tags = suggestion.target_keywords ?? []
  }

  const { data: post, error: insertError } = await db
    .from('blog_posts')
    .insert({
      tenant_id: tenantId,
      suggestion_id: suggestionId,
      title: fm.title || suggestion.proposed_title,
      slug: finalSlug,
      body_mdx: mdxContent,
      excerpt: fm.excerpt || null,
      meta_description: clampMeta(fm.metaDescription) || null,
      tags,
      cluster_id: clusterNames.has(fm.cluster) ? fm.cluster : null,
      status: 'draft',
      drafted_at: new Date().toISOString(),
      suggested_at: suggestion.created_at,
      created_by: 'clem',
    })
    .select('id')
    .single()

  if (insertError) throw new Error(`Failed to insert blog post: ${insertError.message}`)

  console.log(`[clem/draft] Created post "${finalSlug}" (id: ${post.id})`)

  return post.id
}
