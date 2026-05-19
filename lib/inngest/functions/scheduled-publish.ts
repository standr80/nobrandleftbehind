import { inngest } from '../client'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Runs every 5 minutes. Finds all posts with status='scheduled' whose
 * scheduled_for time has passed and flips them to published.
 */
export const scheduledPublish = inngest.createFunction(
  {
    id: 'scheduled-publish',
    name: 'Scheduled Post Publisher',
  },
  { cron: '*/5 * * * *' },
  async () => {
    const db = createAdminClient()
    const now = new Date().toISOString()

    const { data: duePosts, error } = await db
      .from('blog_posts')
      .select('id, title, tenant_id')
      .eq('status', 'scheduled')
      .lte('scheduled_for', now)

    if (error) {
      console.error('[scheduled-publish] DB error:', error.message)
      return { published: 0, error: error.message }
    }

    if (!duePosts?.length) {
      return { published: 0 }
    }

    const ids = duePosts.map((p) => p.id)

    const { error: updateError } = await db
      .from('blog_posts')
      .update({ status: 'published', published_at: now })
      .in('id', ids)

    if (updateError) {
      console.error('[scheduled-publish] Update error:', updateError.message)
      return { published: 0, error: updateError.message }
    }

    console.log(`[scheduled-publish] Published ${ids.length} post(s):`, duePosts.map((p) => p.title))
    return { published: ids.length, postIds: ids }
  },
)
