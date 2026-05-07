import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface Params {
  params: Promise<{ postId: string }>
}

// PATCH — save edits to a post (body, title, excerpt, tags, meta description)
export async function PATCH(request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { postId } = await params
  const body = await request.json()

  const db = createAdminClient()

  // Verify the user belongs to this post's tenant
  const { data: post } = await db
    .from('blog_posts')
    .select('tenant_id')
    .eq('id', postId)
    .single()

  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  const { data: member } = await db
    .from('tenant_members')
    .select('id')
    .eq('tenant_id', post.tenant_id)
    .eq('clerk_user_id', userId)
    .maybeSingle()

  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  type PostUpdate = {
    body_mdx?: string
    title?: string
    slug?: string
    excerpt?: string
    meta_description?: string
    tags?: string[]
  }

  const allowedFields: (keyof PostUpdate)[] = ['body_mdx', 'title', 'slug', 'excerpt', 'meta_description', 'tags']
  const updates: PostUpdate = {}
  for (const field of allowedFields) {
    if (field in body) (updates as Record<string, unknown>)[field] = body[field]
  }

  const { error } = await db.from('blog_posts').update(updates).eq('id', postId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
