// Site discovery for the internal-link map (Settings → Internal links → Scan site).
//
// Firecrawl's /map is the fast path, but it leans on the site having a sitemap: a site
// without one comes back as just its home page. crawlSite() is the fallback: it reads the
// site's own pages and follows their links. No third-party dependency, no credits.
// Relative imports only, so it can be run and tested outside Next.

export interface PageMeta {
  title?: string
  description?: string
}

export interface CrawlOptions {
  /** Max pages to actually download (links on un-downloaded pages are still reported). */
  maxFetches?: number
  /** 0 = just the start page; 2 = start page, its links, and their links. */
  maxDepth?: number
  deadlineMs?: number
}

const UA = 'NBLB-SiteScan/1.0'

export const ASSET_RE = /\.(jpe?g|png|webp|gif|svg|ico|css|js|json|xml|pdf|zip|woff2?|ttf|mp4|webm)(\?|$)/i
export const SKIP_PATH_RE = /^\/(blog|tag|tags|category|author|wp-|cdn-cgi|_)/i
// Pages that are never useful to link to from an article.
const UTILITY_PATH_RE =
  /^\/(log-?in|sign-?in|sign-?up|register|cart|checkout|basket|account|my-account|search|forgot-password|reset-password)(\/|$)/i
// Machine-ID detail pages (e.g. /maker/3f2a…-uuid): numerous and unstable, not link targets.
const UUID_LEAF_RE = /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function normaliseSiteUrl(raw: string): string | null {
  try {
    const p = new URL(raw)
    if (p.protocol !== 'http:' && p.protocol !== 'https:') return null
    p.hash = ''
    p.search = ''
    return p.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

export function hostOf(url: string): string {
  return new URL(url).host.replace(/^www\./, '')
}

/** Same site, a real content page (not an asset, blog/taxonomy, utility or ID page). */
export function isCandidate(url: string, host: string): boolean {
  let p: URL
  try {
    p = new URL(url)
  } catch {
    return false
  }
  if (p.host.replace(/^www\./, '') !== host) return false
  return !(
    ASSET_RE.test(p.pathname) ||
    SKIP_PATH_RE.test(p.pathname) ||
    UTILITY_PATH_RE.test(p.pathname) ||
    UUID_LEAF_RE.test(p.pathname)
  )
}

/** Absolute http(s) URLs from every <a href> in the HTML, resolved against `base`. */
export function extractLinks(html: string, base: string): string[] {
  const out = new Set<string>()
  const re = /<a\s[^>]*?href\s*=\s*(?:"([^"]*)"|'([^']*)')/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const href = (m[1] ?? m[2] ?? '').trim()
    if (!href || /^(#|mailto:|tel:|javascript:|data:)/i.test(href)) continue
    try {
      out.add(new URL(href, base).toString())
    } catch {
      /* ignore malformed href */
    }
  }
  return [...out]
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&') // last, so "&amp;lt;" doesn't double-decode
}

/** <title> + meta description from a page's HTML. */
export function metaFromHtml(html: string): PageMeta {
  const head = html.slice(0, 30000)
  const title = head.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim()
  const description =
    head.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] ??
    head.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)?.[1] ??
    head.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i)?.[1]
  return {
    title: title ? decodeEntities(title) : undefined,
    description: description?.trim() ? decodeEntities(description.trim()) : undefined,
  }
}

/** Run an async fn over items with bounded concurrency. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      results[idx] = await fn(items[idx])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

async function fetchPage(url: string): Promise<{ finalUrl: string; html: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    if (!/text\/html|xhtml/i.test(res.headers.get('content-type') ?? '')) return null
    return { finalUrl: res.url || url, html: (await res.text()).slice(0, 500_000) }
  } catch {
    return null
  }
}

/**
 * Breadth-first crawl from `startUrl`, following same-site links. Results are in
 * discovery order, so shallow pages (the ones worth linking to) come first.
 * Follows redirects, so apex → www and similar just work.
 */
export async function crawlSite(
  startUrl: string,
  opts: CrawlOptions = {},
): Promise<{ urls: string[]; meta: Map<string, PageMeta> }> {
  const maxFetches = opts.maxFetches ?? 25
  const maxDepth = opts.maxDepth ?? 2
  const deadline = Date.now() + (opts.deadlineMs ?? 25_000)

  const meta = new Map<string, PageMeta>()
  const found: string[] = []
  const foundSet = new Set<string>()
  const fetched = new Set<string>()
  let host = hostOf(startUrl)
  let level = [startUrl]
  let fetchCount = 0

  for (let depth = 0; depth <= maxDepth && level.length && Date.now() < deadline; depth++) {
    const batch = level.slice(0, Math.max(0, maxFetches - fetchCount))
    if (!batch.length) break
    fetchCount += batch.length

    const pages = await mapLimit(batch, 6, async (u) => (Date.now() > deadline ? null : fetchPage(u)))
    const next: string[] = []
    for (const page of pages) {
      if (!page) continue
      if (depth === 0) host = hostOf(page.finalUrl)
      const self = normaliseSiteUrl(page.finalUrl)
      if (self) {
        fetched.add(self)
        meta.set(self, metaFromHtml(page.html))
        if (depth === 0 && !foundSet.has(self)) {
          foundSet.add(self)
          found.unshift(self)
        }
      }
      for (const link of extractLinks(page.html, page.finalUrl)) {
        const n = normaliseSiteUrl(link)
        if (!n || foundSet.has(n) || !isCandidate(n, host)) continue
        foundSet.add(n)
        found.push(n)
        next.push(n)
      }
    }
    level = next.filter((u) => !fetched.has(u))
  }
  return { urls: found, meta }
}

/** Firecrawl scrape (renders JavaScript) → the page's links. For client-rendered sites. */
export async function firecrawlLinks(apiKey: string, url: string): Promise<string[]> {
  try {
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, formats: ['links'], onlyMainContent: false }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return []
    const json = (await res.json()) as { data?: { links?: string[] } }
    return json.data?.links ?? []
  } catch {
    return []
  }
}

export type ScanMethod = 'map' | 'crawl' | 'render'

// Below this many pages the sitemap-based map is treated as having missed the site
// (sites without a sitemap come back as just their home page), so we crawl instead.
const MIN_MAPPED_PAGES = 5

/**
 * Find a site's content pages. Firecrawl map first (fast, but sitemap-dependent), then a
 * direct crawl if that came back thin, then a JavaScript-rendering scrape as a last
 * resort. Firecrawl is optional: pass no key and the crawl does the work.
 */
export async function discoverSite(
  siteUrl: string,
  apiKey?: string,
): Promise<{ urls: string[]; meta: Map<string, PageMeta>; method: ScanMethod; mapStatus: string }> {
  const host = hostOf(siteUrl)
  // Keyed ignoring "www.", so example.com/x and www.example.com/x count as one page.
  const index = new Map<string, number>()
  const urls: string[] = []
  const add = (raw: string, preferThisVersion = false) => {
    const n = normaliseSiteUrl(raw)
    if (!n || !isCandidate(n, host)) return
    const p = new URL(n)
    const key = `${p.host.replace(/^www\./, '')}${p.pathname}`
    const existing = index.get(key)
    if (existing !== undefined) {
      // URLs from the crawl are the ones the site really serves (after redirects),
      // so they win over a differently-hosted duplicate from the map.
      if (preferThisVersion) urls[existing] = n
      return
    }
    index.set(key, urls.length)
    urls.push(n)
  }

  let mapStatus = 'skipped (no Firecrawl key)'
  if (apiKey) {
    try {
      const res = await fetch('https://api.firecrawl.dev/v1/map', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: siteUrl, limit: 100 }),
        signal: AbortSignal.timeout(25_000),
      })
      mapStatus = String(res.status)
      if (res.ok) {
        const data = (await res.json()) as { links?: string[]; urls?: string[] }
        for (const u of data.links ?? data.urls ?? []) add(u)
      }
    } catch (e) {
      mapStatus = e instanceof Error ? e.message : 'failed'
    }
  }
  const mapped = urls.length

  const meta = new Map<string, PageMeta>()
  let method: ScanMethod = 'map'
  if (urls.length < MIN_MAPPED_PAGES) {
    const crawl = await crawlSite(siteUrl)
    for (const u of crawl.urls) add(u, true)
    for (const [u, m] of crawl.meta) meta.set(u, m)
    if (urls.length > mapped) method = 'crawl'

    if (urls.length < 2 && apiKey) {
      for (const u of await firecrawlLinks(apiKey, siteUrl)) add(u)
      if (urls.length > 1) method = 'render'
    }
  }
  return { urls, meta, method, mapStatus }
}
