import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { toHtml, wrapInDocument } from '@/lib/mdx/toHtml'
import { repairMojibake } from '@/lib/mdx/repairMojibake'

function escapeAttr(s: string) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { postId } = await params
  const db = createAdminClient()

  const { data: post, error } = await db
    .from('blog_posts')
    .select('id, title, body_mdx, tenant_id, hero_image_url, hero_image_alt')
    .eq('id', postId)
    .maybeSingle()

  if (error || !post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  // Verify the requesting user is a member of this tenant
  const { data: member } = await db
    .from('tenant_members')
    .select('id')
    .eq('tenant_id', post.tenant_id)
    .eq('clerk_user_id', userId)
    .maybeSingle()

  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Repair mojibake here as well as inside toHtml — belt-and-suspenders since
  // this data comes straight from the database which may have stored content
  // with Windows-1252/UTF-8 encoding corruption.
  const cleanMdx = repairMojibake(post.body_mdx ?? '')
  const bodyHtml = cleanMdx ? await toHtml(cleanMdx) : ''
  const heroOpts = {
    heroImageUrl: post.hero_image_url ?? undefined,
    heroImageAlt: post.hero_image_alt ?? post.title,
  }
  const wrap = req.nextUrl.searchParams.get('wrap') === '1'

  // Never cache — content must always be fresh and encoding fixes must apply.
  const noCache = { headers: { 'Cache-Control': 'no-store' } }

  if (wrap) {
    return NextResponse.json({ html: wrapInDocument(post.title, bodyHtml, heroOpts) }, noCache)
  }

  // For the plain copy: prepend a charset declaration so the fragment is safe
  // to save and open directly in a browser without a full HTML wrapper, then
  // the hero image block.
  const heroBlock = heroOpts.heroImageUrl
    ? `<img src="${escapeAttr(heroOpts.heroImageUrl)}" alt="${escapeAttr(heroOpts.heroImageAlt ?? '')}" style="width:100%;max-height:400px;object-fit:cover;border-radius:6px;display:block;margin:0 0 1.5em;">\n`
    : ''
  const copyHtml = `<meta charset="UTF-8">\n${heroBlock}${bodyHtml}`
  return NextResponse.json({ html: copyHtml }, noCache)
}
