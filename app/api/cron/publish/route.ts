import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runPublish } from '@/lib/clem/publish'

/**
 * Vercel Cron — runs every 5 minutes (requires Vercel Pro).
 * Publishes any scheduled posts whose scheduled_for time has passed.
 *
 * For git-based tenants: calls runPublish() to open a GitHub PR.
 * For all other tenants: marks status='published' directly.
 *
 * Protected by CRON_SECRET env var set in Vercel.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()
  const now = new Date().toISOString()

  const { data: duePosts, error } = await db
    .from('blog_posts')
    .select('id, title, tenant_id')
    .eq('status', 'scheduled')
    .lte('scheduled_for', now)

  if (error) {
    console.error('[cron/publish]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!duePosts?.length) {
    return NextResponse.json({ published: 0 })
  }

  // Look up cms_type for all affected tenants in one query
  const tenantIds = [...new Set(duePosts.map((p) => p.tenant_id))]
  const { data: tenants } = await db
    .from('tenants')
    .select('id, cms_type')
    .in('id', tenantIds)

  const cmsTypeByTenant = Object.fromEntries(
    (tenants ?? []).map((t) => [t.id, t.cms_type])
  )

  const gitPosts = duePosts.filter((p) => cmsTypeByTenant[p.tenant_id] === 'git')
  const directPosts = duePosts.filter((p) => cmsTypeByTenant[p.tenant_id] !== 'git')

  const results = { published: 0, pr_opened: 0, errors: 0, postIds: [] as string[] }

  // ── Direct publish (non-git tenants) ──────────────────────────────────────
  if (directPosts.length) {
    const ids = directPosts.map((p) => p.id)
    const { error: updateError } = await db
      .from('blog_posts')
      .update({ status: 'published', published_at: now })
      .in('id', ids)

    if (updateError) {
      console.error('[cron/publish] direct update error:', updateError.message)
    } else {
      results.published += ids.length
      results.postIds.push(...ids)
      console.log(`[cron/publish] Directly published ${ids.length} post(s)`)
    }
  }

  // ── GitHub PR publish (git tenants) ───────────────────────────────────────
  for (const post of gitPosts) {
    try {
      await runPublish(post.tenant_id, post.id)
      results.pr_opened += 1
      results.postIds.push(post.id)
      console.log(`[cron/publish] Opened PR for post "${post.title}" (${post.id})`)
    } catch (err) {
      results.errors += 1
      console.error(`[cron/publish] Failed to open PR for post ${post.id}:`, err)
    }
  }

  return NextResponse.json(results)
}
