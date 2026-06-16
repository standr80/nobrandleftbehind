import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  CORS_HEADERS,
  PUBLIC_CACHE,
  PRIVATE_CACHE,
  resolveTenant,
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
  const cursor = decodeCursor(sp.get('cursor'))
  const limit = Math.min(
    Math.max(parseInt(sp.get('limit') ?? `${DEFAULT_LIMIT}`, 10) || DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  )

  const db = createAdminClient()

  const tenant = await resolveTenant(db, slug)
  if (!tenant) {
    return NextResponse.json(
      { error: 'Tenant not found' },
      { status: 404, headers: { ...CORS_HEADERS, 'Cache-Control': PUBLIC_CACHE } },
    )
  }

  let q = db.from('blog_posts').select(SUMMARY_COLUMNS).eq('tenant_id', tenant.id)

  if (since) {
    // Incremental sync: everything that changed after `since`, oldest first,
    // INCLUDING tombstones (unpublished / soft-deleted).
    q = q.gt('updated_at', since).order('updated_at', { ascending: true }).order('id', { ascending: true })
    if (cursor) {
      q = q.or(`updated_at.gt.${cursor.ts},and(updated_at.eq.${cursor.ts},id.gt.${cursor.id})`)
    }
  } else {
    // Default: live published posts, newest first.
    q = q
      .eq('status', 'published')
      .is('deleted_at', null)
      .order('published_at', { ascending: false })
      .order('id', { ascending: false })
    if (cursor) {
      q = q.or(`published_at.lt.${cursor.ts},and(published_at.eq.${cursor.ts},id.lt.${cursor.id})`)
    }
  }

  if (tag) q = q.contains('tags', [tag])

  const { data, error } = await q.limit(limit + 1)
  if (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500, headers: CORS_HEADERS })
  }

  const rows = (data ?? []) as RawPost[]
  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows

  const posts = page.map((p) =>
    since && !isLive(p) ? toTombstone(p) : toSummary(p, tenant.domain),
  )

  let next_cursor: string | null = null
  if (hasMore) {
    const last = page[page.length - 1]
    const ts = since ? last.updated_at : last.published_at
    if (ts) next_cursor = encodeCursor(ts, last.id)
  }

  const body: Record<string, unknown> = {
    tenant: slug,
    name: tenant.name,
    site_url: `https://${tenant.domain.replace(/^https?:\/\//, '').replace(/\/$/, '')}`,
    generated_at: new Date().toISOString(),
    next_cursor,
    posts,
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
      headers: { ...CORS_HEADERS, ETag: etag, 'Cache-Control': cacheControl },
    })
  }

  return NextResponse.json(body, {
    headers: { ...CORS_HEADERS, ETag: etag, 'Cache-Control': cacheControl },
  })
}
