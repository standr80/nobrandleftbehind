import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { resolveMutationWorkspace } from '@/lib/workspace/active'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 60

interface ScannedPage {
  url: string
  label: string
  description: string
}

function normaliseUrl(raw: string): string {
  const u = raw.trim().replace(/\/$/, '')
  return /^https?:\/\//i.test(u) ? u : `https://${u}`
}

const ASSET_RE = /\.(jpe?g|png|webp|gif|svg|ico|css|js|json|xml|pdf|zip|woff2?|ttf|mp4|webm)(\?|$)/i
const SKIP_PATH_RE = /^\/(blog|tag|tags|category|author|wp-|cdn-cgi|_)/i

function labelFromUrl(u: string): string {
  try {
    const path = new URL(u).pathname.replace(/\/$/, '')
    if (!path) return 'Home'
    const seg = path.split('/').filter(Boolean).pop() || 'Home'
    return seg.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  } catch {
    return u
  }
}

/** Pull <title> + meta description from a page's HTML head (cheap, no scrape credits). */
async function fetchMeta(url: string): Promise<{ title?: string; description?: string }> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'NBLB-SiteScan/1.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return {}
    const head = (await res.text()).slice(0, 30000)
    const title = head.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim()
    const description =
      head.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] ??
      head.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)?.[1] ??
      head.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i)?.[1]
    return { title: title || undefined, description: description?.trim() || undefined }
  } catch {
    return {}
  }
}

/** Run an async fn over items with bounded concurrency. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
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

// POST — scan the active workspace's website and return its content pages
// (URL + label + short description) for building the internal link map.
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tenantId } = await request.json().catch(() => ({}))
  const workspace = await resolveMutationWorkspace(userId, tenantId)
  if (!workspace) return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
  if (workspace.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'FIRECRAWL_API_KEY is not set' }, { status: 500 })

  // resolveMutationWorkspace returns only ids/role, so load the tenant's domain.
  const db = createAdminClient()
  const { data: tenantRow } = await db
    .from('tenants')
    .select('domain')
    .eq('id', workspace.tenantId)
    .maybeSingle()
  if (!tenantRow?.domain) return NextResponse.json({ error: 'Workspace domain not set' }, { status: 400 })

  const siteUrl = normaliseUrl(tenantRow.domain)
  let host: string
  try {
    host = new URL(siteUrl).host.replace(/^www\./, '')
  } catch {
    return NextResponse.json({ error: 'Invalid workspace domain' }, { status: 400 })
  }

  // 1. Map — one cheap call returns all URLs on the site.
  const mapRes = await fetch('https://api.firecrawl.dev/v1/map', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: siteUrl, limit: 100 }),
  })
  if (!mapRes.ok) {
    const text = await mapRes.text()
    return NextResponse.json({ error: `Site scan failed: ${mapRes.status} ${text}` }, { status: 502 })
  }
  const mapData = (await mapRes.json()) as { links?: string[]; urls?: string[] }
  const rawUrls = mapData.links ?? mapData.urls ?? []

  // 2. Filter to same-domain content pages; drop assets, blog, taxonomy pages.
  const seen = new Set<string>()
  const urls = rawUrls
    .map((u) => {
      try {
        const parsed = new URL(u)
        parsed.hash = ''
        parsed.search = ''
        return parsed.toString().replace(/\/$/, '')
      } catch {
        return ''
      }
    })
    .filter((u) => {
      if (!u) return false
      let p: URL
      try { p = new URL(u) } catch { return false }
      if (p.host.replace(/^www\./, '') !== host) return false
      if (ASSET_RE.test(p.pathname)) return false
      if (SKIP_PATH_RE.test(p.pathname)) return false
      if (seen.has(u)) return false
      seen.add(u)
      return true
    })
    .slice(0, 80)

  // 3. Cheap head-fetch each page for title + meta description (no scrape credits).
  const pages: ScannedPage[] = await mapLimit(urls, 10, async (url) => {
    const meta = await fetchMeta(url)
    return {
      url,
      label: meta.title || labelFromUrl(url),
      description: meta.description || meta.title || '',
    }
  })

  pages.sort((a, b) => a.url.localeCompare(b.url))
  return NextResponse.json({ pages })
}
