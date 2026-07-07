import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { triggerDeployHook } from '@/lib/clem/deployHook'
import { runShopifyDelete } from '@/lib/clem/shopify'

interface Params {
  params: Promise<{ postId: string }>
}

async function getPostAndVerifyMember(postId: string, userId: string) {
  const db = createAdminClient()
  const { data: post } = await db
    .from('blog_posts')
    .select('tenant_id, status')
    .eq('id', postId)
    .single()

  if (!post) return { post: null, member: null, db }

  const { data: member } = await db
    .from('tenant_members')
    .select('id')
    .eq('tenant_id', post.tenant_id)
    .eq('clerk_user_id', userId)
    .maybeSingle()

  return { post, member, db }
}

// PATCH — save edits (body, title, excerpt, tags, meta description)
export async function PATCH(request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { postId } = await params
  const body = await request.json()
  const { post, member, db } = await getPostAndVerifyMember(postId, userId)

  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  type PostUpdate = {
    body_mdx?: string
    title?: string
    slug?: string
    excerpt?: string
    meta_description?: string
    tags?: string[]
    hero_image_url?: string | null
    hero_image_credit?: string | null
    hero_image_alt?: string | null
    scheduled_for?: string | null
    auto_scheduled?: boolean
    status?: string
    author_id?: string | null
  }

  const allowedFields: (keyof PostUpdate)[] = [
    'body_mdx', 'title', 'slug', 'excerpt', 'meta_description', 'tags',
    'hero_image_url', 'hero_image_credit', 'hero_image_alt',
    'scheduled_for', 'auto_scheduled', 'author_id',
  ]
  const updates: PostUpdate = {}
  for (const field of allowedFields) {
    if (field in body) (updates as Record<string, unknown>)[field] = body[field]
  }

  // Setting a publish date must also move the post into 'scheduled' status,
  // otherwise the publish cron (which only selects status='scheduled') will
  // never pick it up. Only applies when a non-null date is provided.
  if ('scheduled_for' in updates && updates.scheduled_for) {
    updates.status = 'scheduled'
  }

  const { error } = await db.from('blog_posts').update(updates).eq('id', postId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If we just edited content that's already live (e.g. retitling a published
  // FAQ/post), rebuild the tenant's static site + purge the content cache so the
  // change appears publicly. Drafts don't need this. Fire-and-forget.
  const stillPublished = post.status === 'published' && (updates.status ?? 'published') === 'published'
  if (stillPublished) {
    await triggerDeployHook(post.tenant_id)
  }

  return NextResponse.json({ ok: true })
}

// DELETE — permanently remove a post
export async function DELETE(_request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { postId } = await params
  const { post, member, db } = await getPostAndVerifyMember(postId, userId)

  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Shopify tenants: delete the live article/page BEFORE removing the NBLB row
  // (runShopifyDelete needs the row's shopify_article_id + content_type). If it
  // fails we keep the row so the user can retry rather than orphaning the resource.
  const { data: tenant } = await db
    .from('tenants')
    .select('cms_type')
    .eq('id', post.tenant_id)
    .single()

  if (tenant?.cms_type === 'shopify') {
    try {
      await runShopifyDelete(post.tenant_id, postId)
    } catch (delErr) {
      console.error('[delete] runShopifyDelete failed:', delErr)
      return NextResponse.json(
        { error: delErr instanceof Error ? delErr.message : 'Shopify delete failed' },
        { status: 500 }
      )
    }
  }

  const { error } = await db.from('blog_posts').delete().eq('id', postId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
