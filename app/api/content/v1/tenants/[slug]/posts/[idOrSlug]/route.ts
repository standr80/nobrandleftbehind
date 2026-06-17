import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { toHtml } from '@/lib/mdx/toHtml'
import {
  CORS_HEADERS,
  PUBLIC_CACHE,
  resolveTenant,
  getDefaultAuthor,
  POST_COLUMNS,
  toPost,
  toTombstone,
  isLive,
  etagFor,
  notModified,
  type RawPost,
} from '@/lib/content/api'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; idOrSlug: string }> },
) {
  const { slug, idOrSlug } = await params

  const db = createAdminClient()

  const tenant = await resolveTenant(db, slug)
  if (!tenant) {
    return NextResponse.json(
      { error: 'Tenant not found' },
      { status: 404, headers: { ...CORS_HEADERS, 'Cache-Control': PUBLIC_CACHE } },
    )
  }

  // Resolve by UUID id or by slug (so a stored id survives slug changes).
  const column = UUID_RE.test(idOrSlug) ? 'id' : 'slug'

  const { data, error } = await db
    .from('blog_posts')
    .select(POST_COLUMNS)
    .eq('tenant_id', tenant.id)
    .eq(column, idOrSlug)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500, headers: CORS_HEADERS })
  }

  if (!data) {
    return NextResponse.json(
      { error: 'Post not found' },
      { status: 404, headers: { ...CORS_HEADERS, 'Cache-Control': PUBLIC_CACHE } },
    )
  }

  const post = data as unknown as RawPost

  // Existed but no longer published -> 410 Gone with a tombstone body so a
  // consumer can remove its imported copy.
  if (!isLive(post)) {
    return NextResponse.json(toTombstone(post), {
      status: 410,
      headers: { ...CORS_HEADERS, 'Cache-Control': PUBLIC_CACHE },
    })
  }

  const bodyHtml = post.body_mdx ? await toHtml(post.body_mdx) : ''
  const defaultAuthor = await getDefaultAuthor(db, tenant.id)
  const body = toPost(post, tenant.domain, bodyHtml, defaultAuthor)
  const etag = etagFor(body)

  if (notModified(req, etag)) {
    return new NextResponse(null, {
      status: 304,
      headers: { ...CORS_HEADERS, ETag: etag, 'Cache-Control': PUBLIC_CACHE },
    })
  }

  return NextResponse.json(body, {
    headers: { ...CORS_HEADERS, ETag: etag, 'Cache-Control': PUBLIC_CACHE },
  })
}
