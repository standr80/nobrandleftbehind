import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { resolveMutationWorkspace } from '@/lib/workspace/active'
import { createAdminClient } from '@/lib/supabase/admin'
import { discoverSite, hostOf, mapLimit, metaFromHtml, type PageMeta } from '@/lib/clem/siteScan'

export const maxDuration = 60

interface ScannedPage {
  url: string
  label: string
  description: string
}

const MAX_PAGES = 80

function normaliseDomain(raw: string): string {
  const u = raw.trim().replace(/\/$/, '')
  return /^https?:\/\//i.test(u) ? u : `https://${u}`
}

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
async function fetchMeta(url: string): Promise<PageMeta> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'NBLB-SiteScan/1.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return {}
    return metaFromHtml(await res.text())
  } catch {
    return {}
  }
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

  // resolveMutationWorkspace returns only ids/role, so load the tenant's domain.
  const db = createAdminClient()
  const { data: tenantRow } = await db
    .from('tenants')
    .select('domain')
    .eq('id', workspace.tenantId)
    .maybeSingle()
  if (!tenantRow?.domain) return NextResponse.json({ error: 'Workspace domain not set' }, { status: 400 })

  const siteUrl = normaliseDomain(tenantRow.domain)
  let host: string
  try {
    host = hostOf(siteUrl)
  } catch {
    return NextResponse.json({ error: 'Invalid workspace domain' }, { status: 400 })
  }

  // Firecrawl is optional: it speeds things up and handles JavaScript-only sites, but the
  // scan still works without it (or when it fails) by crawling the site directly.
  const { urls, meta, method, mapStatus } = await discoverSite(siteUrl, process.env.FIRECRAWL_API_KEY)

  if (urls.length === 0) {
    return NextResponse.json(
      {
        error: `Couldn't read any pages from ${host}. Check the workspace domain is correct and the site is online (map status: ${mapStatus}).`,
      },
      { status: 502 },
    )
  }

  // Shallow pages come first (the crawl is breadth-first), so truncating keeps the best ones.
  const limited = urls.slice(0, MAX_PAGES)

  // Title + meta description for each page: reuse what the crawl already downloaded and
  // only head-fetch the rest (no scrape credits).
  const pages: ScannedPage[] = await mapLimit(limited, 10, async (url) => {
    const m = meta.get(url) ?? (await fetchMeta(url))
    return {
      url,
      label: m.title || labelFromUrl(url),
      description: m.description || m.title || '',
    }
  })

  pages.sort((a, b) => a.url.localeCompare(b.url))
  return NextResponse.json({ pages, method })
}
