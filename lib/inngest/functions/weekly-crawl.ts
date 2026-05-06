import { inngest } from '../client'

// Sprint 2 — implemented in lib/clem/suggest.ts (Firecrawl step)
export const weeklyCrawl = inngest.createFunction(
  {
    id: 'weekly-crawl',
    name: 'Weekly Site Crawl',
    triggers: [{ cron: '0 5 * * 1' }], // every Monday at 05:00 UTC (before suggest job)
  },
  async () => {
    // TODO Sprint 2: iterate tenants, crawl each domain, upsert site_crawl_cache
    throw new Error('Not yet implemented — Sprint 2')
  },
)
