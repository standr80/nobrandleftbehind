import { NextRequest } from 'next/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  const { tenantSlug } = await params
  const q = req.nextUrl.searchParams

  const theme  = q.get('theme')        || 'light'
  const accent = q.get('accent')       || '#2563eb'
  const mode   = q.get('mode')         || 'feed'
  const limit  = q.get('limit')        || '6'
  const open   = q.get('open')         || 'same-tab'
  const showImages = q.get('show-images') !== 'false' ? 'true' : 'false'
  const showAuthor = q.get('show-author') !== 'false' ? 'true' : 'false'

  const origin = req.nextUrl.origin

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: ${theme === 'dark' ? '#18181b' : '#f8f8f8'}; }
</style>
</head>
<body>
<script
  src="${origin}/embed.js"
  data-tenant="${tenantSlug}"
  data-theme="${theme}"
  data-accent="${accent}"
  data-mode="${mode}"
  data-limit="${limit}"
  data-open="${open}"
  data-show-images="${showImages}"
  data-show-author="${showAuthor}">
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
