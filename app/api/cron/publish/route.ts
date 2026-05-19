import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Vercel Cron — runs every 5 minutes (requires Vercel Pro).
 * Publishes any scheduled posts whose scheduled_for time has passed.
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
    .select('id, title')
    .eq('status', 'scheduled')
    .lte('scheduled_for', now)

  if (error) {
    console.error('[cron/publish]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!duePosts?.length) {
    return NextResponse.json({ published: 0 })
  }

  const ids = duePosts.map((p) => p.id)

  const { error: updateError } = await db
    .from('blog_posts')
    .update({ status: 'published', published_at: now })
    .in('id', ids)

  if (updateError) {
    console.error('[cron/publish] update error:', updateError.message)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  console.log(`[cron/publish] Published ${ids.length} post(s):`, duePosts.map((p) => p.title))
  return NextResponse.json({ published: ids.length, postIds: ids })
}
