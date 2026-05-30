import Anthropic from '@anthropic-ai/sdk'
import { default as FirecrawlApp } from '@mendable/firecrawl-js'
import { createAdminClient } from '../supabase/admin'
import type { BlogTheme, BlogNavLink } from '../blog/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const CLAUDE_MODEL = 'claude-sonnet-4-6'

// ─── Colour helpers ─────────────────────────────────────────────────────────

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '').trim()
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  }
}

/** Relative luminance (0 = black, 1 = white) per WCAG. */
function luminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG contrast ratio between two hex colours (1–21). */
function contrastRatio(hexA: string, hexB: string): number {
  const a = parseHex(hexA)
  const b = parseHex(hexB)
  if (!a || !b) return 1
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Guarantees legible text on a background. If the proposed text colour fails a
 * minimum contrast ratio, fall back to black or white — whichever contrasts more.
 */
function ensureLegible(textColor: string, bgColor: string, minRatio = 4.5): string {
  if (contrastRatio(textColor, bgColor) >= minRatio) return textColor
  return contrastRatio('#000000', bgColor) >= contrastRatio('#ffffff', bgColor)
    ? '#000000'
    : '#ffffff'
}

/**
 * Scrapes the tenant's homepage (single page, not a full crawl) and asks
 * Claude to extract brand design tokens and navigation structure.
 * The result is saved to tenants.blog_theme and returned.
 */
export async function extractTheme(tenantId: string, overrideUrl?: string): Promise<BlogTheme> {
  const db = createAdminClient()

  const { data: tenant, error } = await db
    .from('tenants')
    .select('id, domain, logo_url, name')
    .eq('id', tenantId)
    .single()

  if (error || !tenant) throw new Error(`Tenant ${tenantId} not found`)

  // Use the override URL if provided, otherwise fall back to the tenant's main domain
  const rawUrl = overrideUrl?.trim() || `https://${tenant.domain}`
  const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`
  console.log(`[clem/extract-theme] Scraping ${url}…`)

  const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! })

  // Single-page scrape with a full-page screenshot. The screenshot lets Claude
  // *see* the rendered header bar, body background, and logo — far more reliable
  // than inferring colours from raw HTML.
  const scrapeResult = await firecrawl.scrape(url, {
    formats: ['html', { type: 'screenshot', fullPage: true }],
  })

  const rawHtml = (scrapeResult as unknown as { html?: string }).html ?? ''
  const screenshotUrl =
    (scrapeResult as unknown as { screenshot?: string }).screenshot ?? null

  // Truncate so we stay within Claude's context budget
  const htmlSample = rawHtml.slice(0, 80_000)

  console.log(
    `[clem/extract-theme] Asking Claude to analyse design tokens… (screenshot: ${screenshotUrl ? 'yes' : 'no'}, logo: ${tenant.logo_url ? 'yes' : 'no'})`,
  )

  const instructions = `You are a brand designer. Analyse this business website and extract design tokens so we can build a blog that visually matches the main site. ${screenshotUrl ? 'A full-page SCREENSHOT of the site is provided — rely on it as the source of truth for colours, and use the HTML to confirm fonts, the logo, and navigation links.' : 'Infer colours from the HTML and any inline/linked CSS.'}${tenant.logo_url ? ' The exact LOGO IMAGE that will be placed in the blog header is also provided — study it carefully.' : ''}

Return a single valid JSON object — no markdown fences, no extra text:
{
  "primaryColor": "#hex — main brand/accent colour for buttons, links, highlights. Prefer a real brand colour over black/white.",
  "backgroundColor": "#hex — the main page/body background colour",
  "textColor": "#hex — primary body text colour",
  "headerBackgroundColor": "#hex — the background colour of the site's HEADER/navigation bar. This is often DIFFERENT from the page background (e.g. a dark or coloured brand band). Read it directly from the screenshot.",
  "headerTextColor": "#hex — the colour of text/links shown in the header, which must be legible on headerBackgroundColor.",
  "headingFont": "CSS font-family string, e.g. 'Montserrat, sans-serif'",
  "bodyFont": "CSS font-family string for body text",
  "logoUrl": "absolute URL of the logo image, or null",
  "logoAlt": "logo alt text, or the company name",
  "navLinks": [ { "label": "visible link text", "url": "absolute URL" } ]
}

Critical rules:
- headerBackgroundColor is the most important value. Look at the actual header bar in the screenshot, not the page body. If the header is a coloured/dark band, capture that colour exactly.
${tenant.logo_url ? '- The provided logo MUST sit legibly on headerBackgroundColor. Judge the logo\'s own colours: if the logo is light/white, headerBackgroundColor must be dark enough for it to show; if the logo is dark, the header must be light enough. When the real site\'s header colour would hide the provided logo, choose the closest on-brand header colour that keeps the logo clearly visible, and set headerTextColor to contrast with it.' : '- Ensure headerTextColor is clearly legible against headerBackgroundColor.'}
- navLinks: main site navigation only (header/nav). Exclude footer, social, and utility links like 'Login'/'Cart'. Max 8. All URLs absolute.
- Colours must be valid 6-digit hex codes. If genuinely indeterminable, use neutral defaults (#1a1a1a text, #ffffff background).

HTML:
${htmlSample}`

  // Build a multimodal message: instructions + optional screenshot + optional logo.
  type Block =
    | { type: 'text'; text: string }
    | { type: 'image'; source: { type: 'url'; url: string } }
  const content: Block[] = [{ type: 'text', text: instructions }]
  if (screenshotUrl) {
    content.push({ type: 'text', text: 'SCREENSHOT of the website:' })
    content.push({ type: 'image', source: { type: 'url', url: screenshotUrl } })
  }
  if (tenant.logo_url) {
    content.push({ type: 'text', text: 'LOGO IMAGE that will go in the blog header:' })
    content.push({ type: 'image', source: { type: 'url', url: tenant.logo_url } })
  }

  const msg = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    messages: [{ role: 'user', content }],
  })

  const responseText = msg.content[0].type === 'text' ? msg.content[0].text : ''

  let parsed: Partial<BlogTheme & { navLinks: BlogNavLink[] }> = {}
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
  } catch {
    console.warn('[clem/extract-theme] Failed to parse Claude response, using defaults')
  }

  const backgroundColor = parsed.backgroundColor ?? '#ffffff'
  const textColor = parsed.textColor ?? '#1a1a1a'
  // Header background defaults to the page background when not detected.
  const headerBackgroundColor = parsed.headerBackgroundColor ?? backgroundColor

  const theme: BlogTheme = {
    primaryColor: parsed.primaryColor ?? '#4f46e5',
    backgroundColor,
    textColor,
    headerBackgroundColor,
    // Safety net: force legible header text even if the model picks poorly.
    headerTextColor: ensureLegible(
      parsed.headerTextColor ?? textColor,
      headerBackgroundColor,
    ),
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
