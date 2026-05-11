import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, s-maxage=300',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

/** Derive a slug from a domain: "www.designsonprint.com" → "designsonprint" */
function domainToSlug(domain: string): string {
  return domain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('.')[0]
    .toLowerCase()
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  const { tenantSlug } = await params

  if (!tenantSlug) {
    return NextResponse.json({ error: 'Missing tenant slug' }, { status: 400, headers: CORS_HEADERS })
  }

  const db = createAdminClient()

  // Find matching tenant by derived slug
  const { data: tenantRows, error: tenantError } = await db
    .from('tenants')
    .select('id, name, domain')
    .ilike('domain', `%${tenantSlug}%`)
    .limit(20)

  if (tenantError) {
    return NextResponse.json({ error: 'Database error' }, { status: 500, headers: CORS_HEADERS })
  }

  const tenant = tenantRows?.find((t) => domainToSlug(t.domain) === tenantSlug.toLowerCase())

  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404, headers: CORS_HEADERS })
  }

  const { data: posts, error: postsError } = await db
    .from('blog_posts')
    .select(
      'title, slug, excerpt, published_at, tags, hero_image_url, hero_image_alt, hero_image_credit, created_by',
    )
    .eq('tenant_id', tenant.id)
    .eq('status', 'published')
    .order('published_at', { ascending: false })

  if (postsError) {
    return NextResponse.json({ error: 'Database error' }, { status: 500, headers: CORS_HEADERS })
  }

  const formattedPosts = (posts ?? []).map((p) => ({
    title: p.title ?? '',
    slug: p.slug ?? '',
    excerpt: p.excerpt ?? '',
    date: p.published_at ?? '',
    tags: p.tags ?? [],
    heroImage: p.hero_image_url ?? '',
    heroImageAlt: p.hero_image_alt ?? '',
    heroImageCredit: p.hero_image_credit ?? '',
    heroImageCreditUrl: '',
    author: p.created_by ?? 'Clem',
    url: `https://${tenant.domain}/blog/${p.slug}`,
  }))

  return NextResponse.json(
    {
      tenant: tenantSlug,
      name: tenant.name,
      posts: formattedPosts,
    },
    { headers: CORS_HEADERS },
  )
}
