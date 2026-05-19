import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateHeroImage } from '@/lib/clem/generateHeroImage'

// Claude + Ideogram + sharp + upload can take up to 60s
export const maxDuration = 60

interface Params {
  params: Promise<{ postId: string }>
}

async function verifyAccess(userId: string, postId: string) {
  const db = createAdminClient()
  const { data: post } = await db
    .from('blog_posts')
    .select('id, tenant_id, title')
    .eq('id', postId)
    .single()

  if (!post) return null

  const { data: member } = await db
    .from('tenant_members')
    .select('id')
    .eq('tenant_id', post.tenant_id)
    .eq('clerk_user_id', userId)
    .maybeSingle()

  if (!member) return null
  return post
}

/**
 * POST — generate 2 Ideogram images for a post.
 * Body: { customPrompt?: string }
 * Returns: { prompt, images: [{ ideogramUrl, supabaseUrl }] }
 */
export async function POST(request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { postId } = await params
  const post = await verifyAccess(userId, postId)
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { customPrompt } = await request.json().catch(() => ({})) as { customPrompt?: string }

  try {
    const result = await generateHeroImage(post.tenant_id, postId, customPrompt)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[generate-hero]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * PATCH — attach a chosen image URL to the post as the hero image.
 * Body: { url: string }
 */
export async function PATCH(request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { postId } = await params
  const post = await verifyAccess(userId, postId)
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { url } = await request.json() as { url: string }
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })

  const db = createAdminClient()
  const { error } = await db
    .from('blog_posts')
    .update({ hero_image_url: url, hero_image_alt: post.title })
    .eq('id', postId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, url })
}
