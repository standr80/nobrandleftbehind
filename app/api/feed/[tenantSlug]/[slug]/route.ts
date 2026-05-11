import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { toHtml } from '@/lib/mdx/toHtml'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, s-maxage=300',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

function domainToSlug(domain: string): string {
  return domain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('.')[0]
    .toLowerCase()
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string; slug: string }> },
) {
  const { tenantSlug, slug } = await params

  const db = createAdminClient()

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

  const { data: post, error: postError } = await db
    .from('blog_posts')
    .select(
      'title, slug, excerpt, published_at, tags, hero_image_url, hero_image_alt, hero_image_credit, created_by, body_mdx',
    )
    .eq('tenant_id', tenant.id)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (postError) {
    return NextResponse.json({ error: 'Database error' }, { status: 500, headers: CORS_HEADERS })
  }

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404, headers: CORS_HEADERS })
  }

  const bodyHtml = post.body_mdx ? await toHtml(post.body_mdx) : ''

  return NextResponse.json(
    {
      title: post.title ?? '',
      slug: post.slug ?? '',
      excerpt: post.excerpt ?? '',
      date: post.published_at ?? '',
      tags: post.tags ?? [],
      heroImage: post.hero_image_url ?? '',
      heroImageAlt: post.hero_image_alt ?? '',
      heroImageCredit: post.hero_image_credit ?? '',
      heroImageCreditUrl: '',
      author: post.created_by ?? 'Clem',
      url: `https://${tenant.domain}/blog/${post.slug}`,
      body_html: bodyHtml,
    },
    { headers: CORS_HEADERS },
  )
}
