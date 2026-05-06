import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { weeklySuggest } from '@/lib/inngest/functions/weekly-suggest'
import { weeklyCrawl } from '@/lib/inngest/functions/weekly-crawl'
import { scheduledPublish } from '@/lib/inngest/functions/scheduled-publish'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [weeklySuggest, weeklyCrawl, scheduledPublish],
})
