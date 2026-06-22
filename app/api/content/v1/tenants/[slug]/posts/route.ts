import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  CORS_HEADERS,
  PUBLIC_CACHE,
  PRIVATE_CACHE,
  NO_STORE,
  contentTag,
  resolveTenant,
  getDefaultAuthor,
  SUMMARY_COLUMNS,
  toSummary,
  toTombstone,
  isLive,
  etagFor,
  notModified,
  type RawPost,
} from '@/lib/content/api'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

function decodeCursor(cursor: string | null): { ts: string; id: string } | null {
  if (!cursor) return null
  try {
    const [ts, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('::')
    if (!ts || !id) return null
    return { ts, id }
  } catch {
    return null
  }
}

function encodeCursor(ts: string, id: string): string {
  return Buffer.from(`${ts}::${id}`, 'utf8').toString('base64url')
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const sp = req.nextUrl.searchParams

  const since = sp.get('since')
  const tag = sp.get('tag')
  const includeTheme = sp.get('include') === 'theme'

  const db = createAdminClient()

  const tenant = await resolveTenant(db, slug)
  if (!tenant) {
    return NextResponse.json(
      { error: 'Tenant not found' },
      { status: 404, headers: { ...CORS_HEADERS, 'Cache-Control': NO_STORE } },
    )
  }

  // Posts with no attributed author fall back to the tenant's default author.
  const defaultAuthor = await getDefaultAuthor(db, tenant.id)

  const siteUrl = `https://${tenant.domain.replace(/^https?:\/\//, '').replace(/\/$/, '')}`
  let body: Record<string, unknown>

  if (since) {
    // ── Incremental sync (cursor/keyset, includes tombstones) ────────────────
    const cursor = decodeCursor(sp.get('cursor'))
    const limit = Math.min(
      Math.max(parseInt(sp.get('limit') ?? `${DEFAULT_LIMIT}`, 10) || DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    )

    let q = db
      .from('blog_posts')
      .select(SUMMARY_COLUMNS)
      .eq('tenant_id', tenant.id)
      .gt('updated_at', since)
      .order('updated_at', { ascending: true })
      .order('id', { ascending: true })
    if (cursor) {
      q = q.or(`updated_at.gt.${cursor.ts},and(updated_at.eq.${cursor.ts},id.gt.${cursor.id})`)
    }
    if (tag) q = q.contains('tags', [tag])

    const { data, error } = await q.limit(limit + 1)
    if (error) {
      return NextResponse.json({ error: 'Database error' }, { status: 500, headers: CORS_HEADERS })
    }
    const rows = (data ?? []) as unknown as RawPost[]
    const hasMore = rows.length > limit
    const pageRows = hasMore ? rows.slice(0, limit) : rows
    let next_cursor: string | null = null
    if (hasMore) {
      const last = pageRows[pageRows.length - 1]
      if (last.updated_at) next_cursor = encodeCursor(last.updated_at, last.id)
    }
    body = {
      tenant: slug,
      name: tenant.name,
      site_url: siteUrl,
      generated_at: new Date().toISOString(),
      next_cursor,
      posts: pageRows.map((p) => (isLive(p) ? toSummary(p, tenant.domain, defaultAuthor) : toTombstone(p))),
    }
  } else {
    // ── Public listing (page-based, with total count for numbered paging) ────
    const perPage = Math.min(
      Math.max(parseInt(sp.get('per_page') ?? sp.get('limit') ?? `${DEFAULT_LIMIT}`, 10) || DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    )
    const pageNum = Math.max(parseInt(sp.get('page') ?? '1', 10) || 1, 1)
    const from = (pageNum - 1) * perPage

    let q = db
      .from('blog_posts')
      .select(SUMMARY_COLUMNS, { count: 'exact' })
      .eq('tenant_id', tenant.id)
      .eq('status', 'published')
      .is('deleted_at', null)
      .order('published_at', { ascending: false })
      .order('id', { ascending: false })
    if (tag) q = q.contains('tags', [tag])

    const { data, error, count } = await q.range(from, from + perPage - 1)
    if (error) {
      return NextResponse.json({ error: 'Database error' }, { status: 500, headers: CORS_HEADERS })
    }
    const total = count ?? 0
    body = {
      tenant: slug,
      name: tenant.name,
      site_url: siteUrl,
      generated_at: new Date().toISOString(),
      page: pageNum,
      per_page: perPage,
      total,
      total_pages: Math.max(1, Math.ceil(total / perPage)),
      posts: ((data ?? []) as unknown as RawPost[]).map((p) => toSummary(p, tenant.domain, defaultAuthor)),
    }
  }

  if (includeTheme) {
    body.theme = { ...(tenant.blog_theme as object | null), footer: tenant.blog_footer ?? '' }
  }

  // `since` responses are consumer-specific -> short private TTL.
  // The unparameterised list is the shared, edge-cacheable hot path.
  const cacheControl = since ? PRIVATE_CACHE : PUBLIC_CACHE
  const etag = etagFor(body)

  if (notModified(req, etag)) {
    return new NextResponse(null, {
      status: 304,
      headers: { ...CORS_HEADERS, ETag: etag, 'Cache-Control': cacheControl, 'Cache-Tag': contentTag(tenant.id) },
    })
  }

  return NextResponse.json(body, {
    headers: { ...CORS_HEADERS, ETag: etag, 'Cache-Control': cacheControl, 'Cache-Tag': contentTag(tenant.id) },
  })
}
