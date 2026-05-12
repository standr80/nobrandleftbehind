import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { scheduledPublish } from '@/lib/inngest/functions/scheduled-publish'

// weekly-crawl and weekly-suggest have been removed — crawls are now
// triggered manually by users from the Settings → Clem page.

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [scheduledPublish],
})
