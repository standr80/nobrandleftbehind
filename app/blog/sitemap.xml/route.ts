import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { getTenantByBlogHost } from '@/lib/blog/getTenantByBlogHost'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const headersList = await headers()
  const blogHost = headersList.get('x-blog-host')

  if (!blogHost) return new NextResponse('Not found', { status: 404 })

  const tenant = await getTenantByBlogHost(blogHost)
  if (!tenant) return new NextResponse('Not found', { status: 404 })

  const db = createAdminClient()
  const { data: posts } = await db
    .from('blog_posts')
    .select('slug, published_at, tags')
    .eq('tenant_id', tenant.id)
    .eq('status', 'published')
    .order('published_at', { ascending: false })

  const blogUrl = `https://${blogHost}`

  // Collect unique tags
  const tags = Array.from(
    new Set((posts ?? []).flatMap((p) => p.tags ?? []))
  )

  const urlEntries = [
    // Listing page
    `  <url>
    <loc>${blogUrl}</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`,
    // Tag pages
    ...tags.map((tag) => `  <url>
    <loc>${blogUrl}/tags/${encodeURIComponent(tag)}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`),
    // Post pages
    ...(posts ?? []).map((post) => `  <url>
    <loc>${blogUrl}/${post.slug}</loc>
    <lastmod>${post.published_at ? new Date(post.published_at).toISOString().split('T')[0] : ''}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`),
  ].join('\n')

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`

  return new NextResponse(sitemap, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
