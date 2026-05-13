import Anthropic from '@anthropic-ai/sdk'
import { default as FirecrawlApp } from '@mendable/firecrawl-js'
import { createAdminClient } from '../supabase/admin'
import type { BlogTheme, BlogNavLink } from '../blog/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const CLAUDE_MODEL = 'claude-sonnet-4-20250514'

/**
 * Scrapes the tenant's homepage (single page, not a full crawl) and asks
 * Claude to extract brand design tokens and navigation structure.
 * The result is saved to tenants.blog_theme and returned.
 */
export async function extractTheme(tenantId: string): Promise<BlogTheme> {
  const db = createAdminClient()

  const { data: tenant, error } = await db
    .from('tenants')
    .select('id, domain, logo_url, name')
    .eq('id', tenantId)
    .single()

  if (error || !tenant) throw new Error(`Tenant ${tenantId} not found`)

  const url = `https://${tenant.domain}`
  console.log(`[clem/extract-theme] Scraping ${url}…`)

  const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! })

  // Single-page scrape — much faster and cheaper than a full crawl
  const scrapeResult = await firecrawl.scrape(url, {
    formats: ['html'],
  })

  const rawHtml = (scrapeResult as unknown as { html?: string }).html ?? ''

  // Truncate so we stay within Claude's context budget
  const htmlSample = rawHtml.slice(0, 80_000)

  console.log(`[clem/extract-theme] Asking Claude to analyse design tokens…`)

  const msg = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `Analyse the following HTML from a business website and extract its core brand design tokens and navigation structure. Return a single valid JSON object — no markdown fences, no extra text.

Required JSON shape:
{
  "primaryColor": "#hex — the main brand/accent colour used for buttons, links, headings or highlights. Prefer a specific brand colour over generic black/white.",
  "backgroundColor": "#hex — the main page background colour",
  "textColor": "#hex — the primary body text colour",
  "headingFont": "font-family string exactly as it would appear in CSS, e.g. 'Montserrat, sans-serif'",
  "bodyFont": "font-family string for body text",
  "logoUrl": "absolute URL of the logo image, or null if not found",
  "logoAlt": "alt text for the logo, or the company name",
  "navLinks": [
    { "label": "visible link text", "url": "absolute URL" }
  ]
}

Rules:
- navLinks must be the main site navigation only (header/nav element) — exclude footer links, social links, and utility links like 'Login' or 'Cart'. Maximum 8 links.
- All URLs in navLinks must be absolute (prepend the site domain if relative).
- If a font is loaded via Google Fonts or @import, use the font-family name you can identify from the CSS or font link tags.
- If you cannot determine a value, use a sensible neutral default (e.g. "#1a1a1a" for text, "#ffffff" for background).
- Colours must be valid 6-digit hex codes.

HTML:
${htmlSample}`,
      },
    ],
  })

  const responseText = msg.content[0].type === 'text' ? msg.content[0].text : ''

  let parsed: Partial<BlogTheme & { navLinks: BlogNavLink[] }> = {}
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
  } catch {
    console.warn('[clem/extract-theme] Failed to parse Claude response, using defaults')
  }

  const theme: BlogTheme = {
    primaryColor: parsed.primaryColor ?? '#4f46e5',
    backgroundColor: parsed.backgroundColor ?? '#ffffff',
    textColor: parsed.textColor ?? '#1a1a1a',
    headingFont: parsed.headingFont ?? 'system-ui, sans-serif',
    bodyFont: parsed.bodyFont ?? 'Georgia, serif',
    // Prefer the logo already stored in tenant settings over whatever Claude found
    logoUrl: tenant.logo_url ?? parsed.logoUrl ?? null,
    logoAlt: parsed.logoAlt ?? tenant.name ?? null,
    navLinks: Array.isArray(parsed.navLinks) ? parsed.navLinks : [],
    extractedAt: new Date().toISOString(),
  }

  // Save to database
  await db
    .from('tenants')
    .update({ blog_theme: theme as unknown as import('../supabase/types').Json })
    .eq('id', tenantId)

  console.log(`[clem/extract-theme] Theme saved for tenant ${tenantId}`)
  return theme
}
