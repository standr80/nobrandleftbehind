import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  const headersList = await headers()
  const blogHost = headersList.get('x-blog-host')

  const baseUrl = blogHost ? `https://${blogHost}` : ''

  const content = `User-agent: *
Allow: /

Sitemap: ${baseUrl}/sitemap.xml
`

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, s-maxage=86400',
    },
  })
}
