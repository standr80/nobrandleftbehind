import { NextRequest } from 'next/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  const { tenantSlug } = await params
  const q = req.nextUrl.searchParams

  const pageSize = q.get('page-size') || '6'
  const accent = q.get('accent') || ''
  const accentAttr = accent ? ` data-accent="${accent}"` : ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #ffffff; }
</style>
</head>
<body>
<div id="nblb-blog"></div>
<script
  src="/blog.js"
  data-tenant="${tenantSlug}"
  data-page-size="${pageSize}"${accentAttr}>
</script>
</body>
</html>`

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
