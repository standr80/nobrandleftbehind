import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  CORS_HEADERS,
  PUBLIC_CACHE,
  resolveTenant,
  etagFor,
  notModified,
} from '@/lib/content/api'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

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
      { status: 404, headers: { ...CORS_HEADERS, 'Cache-Control': PUBLIC_CACHE } },
    )
  }

  const body = {
    tenant: slug,
    name: tenant.name,
    site_url: `https://${tenant.domain.replace(/^https?:\/\//, '').replace(/\/$/, '')}`,
    theme: tenant.blog_theme ?? {},
    footer: tenant.blog_footer ?? '',
  }

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
