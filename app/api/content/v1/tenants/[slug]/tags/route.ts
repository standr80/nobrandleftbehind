import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSidebarData } from '@/lib/blog/getSidebarData'
import {
  CORS_HEADERS,
  PUBLIC_CACHE,
  NO_STORE,
  contentTag,
  resolveTenant,
  etagFor,
  notModified,
} from '@/lib/content/api'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

/**
 * Tag frequency for a tenant's published posts — drives the embed's
 * "Browse by topic" sidebar. Reuses getSidebarData so the embed and the
 * server-rendered hosted blog stay consistent.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const db = createAdminClient()

  const tenant = await resolveTenant(db, slug)
  if (!tenant) {
    return NextResponse.json(
      { error: 'Tenant not found' },
      { status: 404, headers: { ...CORS_HEADERS, 'Cache-Control': NO_STORE } },
    )
  }

  const sidebar = await getSidebarData(tenant.id)
  const body = {
    tenant: slug,
    name: tenant.name,
    top_tags: sidebar.topTags,
    all_tags: sidebar.allTags,
    has_more_tags: sidebar.hasMoreTags,
  }

  const etag = etagFor(body)
  if (notModified(req, etag)) {
    return new NextResponse(null, {
      status: 304,
      headers: { ...CORS_HEADERS, ETag: etag, 'Cache-Control': PUBLIC_CACHE, 'Cache-Tag': contentTag(tenant.id) },
    })
  }

  return NextResponse.json(body, {
    headers: { ...CORS_HEADERS, ETag: etag, 'Cache-Control': PUBLIC_CACHE, 'Cache-Tag': contentTag(tenant.id) },
  })
}
