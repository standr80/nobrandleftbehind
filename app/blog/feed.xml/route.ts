import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { getTenantByBlogHost } from '@/lib/blog/getTenantByBlogHost'
import { createAdminClient } from '@/lib/supabase/admin'

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const headersList = await headers()
  const blogHost = headersList.get('x-blog-host')

  if (!blogHost) {
    return new NextResponse('Not found', { status: 404 })
  }

  const tenant = await getTenantByBlogHost(blogHost)
  if (!tenant) return new NextResponse('Not found', { status: 404 })

  const db = createAdminClient()
  const { data: posts } = await db
    .from('blog_posts')
    .select('title, slug, excerpt, published_at, tags')
    .eq('tenant_id', tenant.id)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(50)

  const blogUrl = `https://${blogHost}`

  const items = (posts ?? [])
    .map((post) => {
      const postUrl = `${blogUrl}/${post.slug}`
      const pubDate = post.published_at ? new Date(post.published_at).toUTCString() : ''
      const categories = (post.tags ?? [])
        .map((t) => `    <category>${escapeXml(t)}</category>`)
        .join('\n')

      return `  <item>
    <title>${escapeXml(post.title)}</title>
    <link>${postUrl}</link>
    <guid isPermaLink="true">${postUrl}</guid>
    <pubDate>${pubDate}</pubDate>
    <description>${escapeXml(post.excerpt ?? '')}</description>
${categories}
  </item>`
    })
    .join('\n')

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(tenant.name)} Blog</title>
    <link>${blogUrl}</link>
    <description>Latest articles from ${escapeXml(tenant.name)}</description>
    <language>en</language>
    <atom:link href="${blogUrl}/feed.xml" rel="self" type="application/rss+xml" />
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`

  return new NextResponse(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
