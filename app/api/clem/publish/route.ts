import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runPublish } from '@/lib/clem/publish'
import { triggerDeployHook } from '@/lib/clem/deployHook'

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tenantId, postId } = await request.json()
  if (!tenantId || !postId)
    return NextResponse.json({ error: 'tenantId and postId required' }, { status: 400 })

  const db = createAdminClient()

  // Branch on publishing mode. Git tenants open a PR (status -> pr_open, then
  // 'published' on merge). All other tenants — including 'embed' (NBLB-hosted) —
  // publish directly: the post is live as soon as it's marked 'published',
  // because the Content API + blog.js embed read straight from Supabase.
  const { data: tenant } = await db
    .from('tenants')
    .select('cms_type')
    .eq('id', tenantId)
    .single()

  if (tenant?.cms_type === 'git') {
    await runPublish(tenantId, postId)
    return NextResponse.json({ ok: true, mode: 'git_pr' })
  }

  const now = new Date().toISOString()
  const { error } = await db
    .from('blog_posts')
    .update({ status: 'published', published_at: now, updated_at: now })
    .eq('id', postId)
    .eq('tenant_id', tenantId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await db.from('publish_log').insert({
    tenant_id: tenantId,
    post_id: postId,
    action: 'direct_publish',
    success: true,
    attempted_at: now,
  })

  await triggerDeployHook(tenantId)
  return NextResponse.json({ ok: true, mode: 'direct' })
}
