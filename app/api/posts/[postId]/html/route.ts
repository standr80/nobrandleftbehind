import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { toHtml, wrapInDocument } from '@/lib/mdx/toHtml'

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

  const bodyHtml = post.body_mdx ? await toHtml(post.body_mdx) : ''
  const wrap = req.nextUrl.searchParams.get('wrap') === '1'

  if (wrap) {
    return NextResponse.json({
      html: wrapInDocument(post.title, bodyHtml, {
        heroImageUrl: post.hero_image_url ?? undefined,
        heroImageAlt: post.hero_image_alt ?? post.title,
      }),
    })
  }

  return NextResponse.json({ html: bodyHtml })
}
