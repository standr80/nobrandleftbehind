/**
 * Scout Pipeline 2 — Competitor Intelligence
 *
 * For each competitor URL:
 * 1. Crawl with Firecrawl and hash the result
 * 2. Compare hash to previous snapshot — skip if unchanged
 * 3. Diff page inventory (new, removed, changed pages)
 * 4. Detect new blog posts
 * 5. Detect pricing page changes
 * 6. DataForSEO keyword gap analysis
 * 7. DataForSEO backlink monitoring
 * 8. Persist snapshot to scout_competitor_snapshots
 */

import crypto from 'crypto'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { getKeywordGap, getNewBacklinks, type DfsGapItem } from '@/lib/integrations/dataforseo/client'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CompetitorResult {
  competitorUrl: string
  snapshotId: string
  isNew: boolean
  changed: boolean
  newPages: PageItem[]
  removedPages: PageItem[]
  newBlogPosts: BlogPostItem[]
  pricingChanged: boolean
  pricingChangeSummary: string | null
  keywordGaps: DfsGapItem[]
  newHighAuthBacklinks: BacklinkItem[]
  error?: string
}

interface PageItem {
  url: string
  title?: string
  estimatedTopic?: string
}

interface BlogPostItem {
  url: string
  title: string
  estimatedTopic?: string
  wordCount?: number
}

interface BacklinkItem {
  domainFrom: string
  domainRank: number | null
  urlFrom: string
  urlTo: string
}

interface FirecrawlPage {
  url: string
  title?: string
  markdown?: string
  metadata?: { title?: string }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashCrawl(pages: FirecrawlPage[]): string {
  const content = pages
    .map((p) => p.url)
    .sort()
    .join('\n')
  return crypto.createHash('sha256').update(content).digest('hex')
}

function detectBlogPosts(pages: FirecrawlPage[], prevUrls: string[]): BlogPostItem[] {
  const blogPatterns = ['/blog/', '/news/', '/articles/', '/insights/', '/resources/', '/posts/']
  const prevSet = new Set(prevUrls)

  return pages
    .filter((p) => {
      if (prevSet.has(p.url)) return false
      return blogPatterns.some((pat) => p.url.includes(pat))
    })
    .map((p) => ({
      url: p.url,
      title: p.metadata?.title ?? p.title ?? p.url,
      wordCount: p.markdown ? p.markdown.split(/\s+/).length : undefined,
    }))
}

function detectPricingPage(pages: FirecrawlPage[]): FirecrawlPage | null {
  const pricingPatterns = ['/pricing', '/plans', '/packages', '/tariffs', '/buy']
  return (
    pages.find((p) => pricingPatterns.some((pat) => p.url.toLowerCase().includes(pat))) ?? null
  )
}

async function summarisePricingChange(
  oldContent: string,
  newContent: string,
  competitorUrl: string,
): Promise<string> {
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: `Compare these two versions of a competitor's pricing page and summarise what changed in one or two plain-English sentences. Be specific about price changes if visible.

Competitor: ${competitorUrl}

PREVIOUS VERSION:
${oldContent.slice(0, 2000)}

CURRENT VERSION:
${newContent.slice(0, 2000)}

Summary:`,
      },
    ],
  })
  return (msg.content[0] as { type: 'text'; text: string }).text.trim()
}

/** Ensure URL has a scheme so new URL() doesn't throw. */
function normaliseUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url
  return `https://${url}`
}

/**
 * Fast competitor crawl using Firecrawl map (synchronous, returns URL list)
 * then targeted scrapes of high-value pages (homepage + pricing + blog index).
 * Avoids the async crawl+poll pattern which is too slow for 3 competitors
 * within a single Vercel function invocation.
 */
async function crawlWithFirecrawl(rawUrl: string): Promise<FirecrawlPage[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) throw new Error('FIRECRAWL_API_KEY is not set')

  const url = normaliseUrl(rawUrl)

  // Step 1: map — synchronous, returns all URLs on the site
  const mapRes = await fetch('https://api.firecrawl.dev/v1/map', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, limit: 100 }),
  })

  if (!mapRes.ok) {
    const text = await mapRes.text()
    throw new Error(`Firecrawl map failed for ${url}: ${mapRes.status} ${text}`)
  }

  const mapData = (await mapRes.json()) as { links?: string[]; urls?: string[] }
  const allUrls: string[] = mapData.links ?? mapData.urls ?? []

  // Step 2: pick the most valuable pages to actually scrape for content
  const pricingPatterns = ['/pricing', '/plans', '/packages', '/tariffs', '/buy']
  const blogPatterns = ['/blog', '/news', '/articles', '/insights', '/resources', '/posts']

  const pricingUrls = allUrls.filter((u) =>
    pricingPatterns.some((p) => u.toLowerCase().includes(p)),
  ).slice(0, 2)

  const blogIndexUrls = allUrls.filter((u) =>
    blogPatterns.some((p) => {
      const path = new URL(normaliseUrl(u)).pathname
      // Blog index = exactly /blog or /blog/ not individual posts
      return path === p || path === `${p}/`
    }),
  ).slice(0, 1)

  const newBlogPostUrls = allUrls.filter((u) =>
    blogPatterns.some((p) => u.toLowerCase().includes(`${p}/`)) &&
    !blogIndexUrls.includes(u),
  ).slice(0, 5)

  // Always scrape the homepage
  const urlsToScrape = [...new Set([url, ...pricingUrls, ...blogIndexUrls, ...newBlogPostUrls])]

  // Step 3: scrape selected pages in parallel (synchronous endpoint)
  const scraped = await Promise.allSettled(
    urlsToScrape.map(async (pageUrl) => {
      const scrapeRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: pageUrl, formats: ['markdown'] }),
      })
      if (!scrapeRes.ok) return null
      const data = (await scrapeRes.json()) as {
        success?: boolean
        data?: { markdown?: string; metadata?: { title?: string } }
      }
      if (!data.success || !data.data) return null
      return {
        url: pageUrl,
        markdown: data.data.markdown,
        metadata: data.data.metadata,
      } as FirecrawlPage
    }),
  )

  // Combine: all mapped URLs (for inventory diff) + scraped content for key pages
  const scrapedPages = scraped
    .filter((r): r is PromiseFulfilledResult<FirecrawlPage | null> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((p): p is FirecrawlPage => p !== null)

  // Return mapped URLs as stub pages (for inventory), plus scraped content pages
  const mappedStubs: FirecrawlPage[] = allUrls
    .filter((u) => !urlsToScrape.includes(u))
    .map((u) => ({ url: u }))

  return [...scrapedPages, ...mappedStubs]
}

// ─── Main pipeline function ───────────────────────────────────────────────────

export async function runCompetitorPipeline(
  tenantId: string,
  clientDomain: string,
  competitorUrls: string[],
): Promise<CompetitorResult[]> {
  const db = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // Fetch keyword gaps across all competitors in one DataForSEO call
  let allKeywordGaps: DfsGapItem[] = []
  try {
    allKeywordGaps = await getKeywordGap(clientDomain, competitorUrls)
  } catch (err) {
    console.error('[Scout] DataForSEO keyword gap error:', err)
  }

  const results: CompetitorResult[] = []

  for (const rawCompetitorUrl of competitorUrls) {
    const competitorUrl = normaliseUrl(rawCompetitorUrl)
    try {
      // Check if crawled in last 24h (avoid redundant Firecrawl cost)
      const { data: recentSnapshot } = await db
        .from('scout_competitor_snapshots')
        .select('id, raw_crawl_hash, pricing_page_content, snapshot_date')
        .eq('tenant_id', tenantId)
        .eq('competitor_url', competitorUrl)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const lastSnapshotDate = recentSnapshot?.snapshot_date
      const crawledToday =
        lastSnapshotDate && new Date(lastSnapshotDate) >= new Date(Date.now() - 23 * 60 * 60 * 1000)

      // Crawl (or skip if recent)
      let pages: FirecrawlPage[] = []
      if (!crawledToday) {
        pages = await crawlWithFirecrawl(competitorUrl)
      }

      const newHash = crawledToday ? recentSnapshot?.raw_crawl_hash ?? '' : hashCrawl(pages)
      const unchanged = crawledToday || newHash === recentSnapshot?.raw_crawl_hash

      if (unchanged && recentSnapshot) {
        results.push({
          competitorUrl,
          snapshotId: recentSnapshot.id,
          isNew: false,
          changed: false,
          newPages: [],
          removedPages: [],
          newBlogPosts: [],
          pricingChanged: false,
          pricingChangeSummary: null,
          keywordGaps: allKeywordGaps.filter((g) =>
            g.competitor_url?.includes(new URL(competitorUrl).hostname),
          ),
          newHighAuthBacklinks: [],
        })
        continue
      }

      // Determine previous page URLs from last snapshot
      const prevPages = (recentSnapshot as { new_pages?: PageItem[] } | null)
      const prevUrls: string[] = []
      if (prevPages?.new_pages) {
        for (const p of prevPages.new_pages) {
          if (p.url) prevUrls.push(p.url)
        }
      }

      // Page diff
      const currentUrls = new Set(pages.map((p) => p.url))
      const prevUrlSet = new Set(prevUrls)
      const newPagesList: PageItem[] = pages
        .filter((p) => !prevUrlSet.has(p.url))
        .map((p) => ({ url: p.url, title: p.metadata?.title ?? p.title }))
      const removedPages: PageItem[] = prevUrls
        .filter((u) => !currentUrls.has(u))
        .map((u) => ({ url: u }))

      // New blog posts
      const newBlogPosts = detectBlogPosts(pages, prevUrls)

      // Pricing change detection
      let pricingChanged = false
      let pricingChangeSummary: string | null = null
      const pricingPage = detectPricingPage(pages)
      if (pricingPage?.markdown && recentSnapshot?.pricing_page_content) {
        const oldHash = crypto
          .createHash('md5')
          .update(recentSnapshot.pricing_page_content)
          .digest('hex')
        const newHashPricing = crypto.createHash('md5').update(pricingPage.markdown).digest('hex')
        if (oldHash !== newHashPricing) {
          pricingChanged = true
          pricingChangeSummary = await summarisePricingChange(
            recentSnapshot.pricing_page_content,
            pricingPage.markdown,
            competitorUrl,
          )
        }
      }

      // Backlinks
      let newHighAuthBacklinks: BacklinkItem[] = []
      try {
        const rawBacklinks = await getNewBacklinks(
          new URL(competitorUrl).hostname,
          sevenDaysAgo,
          20,
        )
        newHighAuthBacklinks = rawBacklinks
          .filter((b) => (b.domain_rank ?? 0) > 50)
          .map((b) => ({
            domainFrom: b.domain_from,
            domainRank: b.domain_rank,
            urlFrom: b.url_from,
            urlTo: b.url_to,
          }))
      } catch (err) {
        console.error(`[Scout] Backlinks error for ${competitorUrl}:`, err)
      }

      // Persist snapshot
      const { data: newSnapshot, error: insertError } = await db
        .from('scout_competitor_snapshots')
        .insert({
          tenant_id: tenantId,
          competitor_url: competitorUrl,
          snapshot_date: today,
          page_count: pages.length,
          new_pages: newPagesList as unknown as import('@/lib/supabase/types').Json,
          removed_pages: removedPages as unknown as import('@/lib/supabase/types').Json,
          new_blog_posts: newBlogPosts as unknown as import('@/lib/supabase/types').Json,
          pricing_page_content: pricingPage?.markdown ?? null,
          pricing_changed: pricingChanged,
          pricing_change_summary: pricingChangeSummary,
          raw_crawl_hash: newHash,
        })
        .select('id')
        .single()

      if (insertError) throw new Error(`Snapshot insert failed: ${insertError.message}`)

      // Alert for pricing change (urgent — don't wait for weekly briefing)
      if (pricingChanged && pricingChangeSummary) {
        await db.from('scout_alerts').insert({
          tenant_id: tenantId,
          alert_type: 'competitor_pricing_change',
          severity: 'urgent',
          title: `Pricing change detected: ${new URL(competitorUrl).hostname}`,
          detail: pricingChangeSummary,
          data: { competitor_url: competitorUrl } as unknown as import('@/lib/supabase/types').Json,
        })
      }

      results.push({
        competitorUrl,
        snapshotId: newSnapshot.id,
        isNew: !recentSnapshot,
        changed: !unchanged,
        newPages: newPagesList,
        removedPages,
        newBlogPosts,
        pricingChanged,
        pricingChangeSummary,
        keywordGaps: allKeywordGaps.filter((g) =>
          g.competitor_url?.includes(new URL(competitorUrl).hostname),
        ),
        newHighAuthBacklinks,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[Scout] Competitor pipeline error for ${competitorUrl}:`, message)
      results.push({
        competitorUrl,
        snapshotId: '',
        isNew: false,
        changed: false,
        newPages: [],
        removedPages: [],
        newBlogPosts: [],
        pricingChanged: false,
        pricingChangeSummary: null,
        keywordGaps: [],
        newHighAuthBacklinks: [],
        error: message,
      })
    }
  }

  return results
}
