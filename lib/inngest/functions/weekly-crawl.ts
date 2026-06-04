import { inngest } from '../client'
import { createAdminClient } from '../../supabase/admin'
import { runCrawl } from '../../clem/suggest'

export const weeklyCrawl = inngest.createFunction(
  {
    id: 'weekly-crawl',
    name: 'Weekly Site Crawl',
    triggers: [{ cron: '0 5 * * 1' }], // every Monday at 05:00 UTC
  },
  async ({ step }) => {
    const db = createAdminClient()

    const { data: tenants, error } = await db
      .from('tenants')
      .select('id, name, domain')
      .eq('post_cadence_active', true)

    if (error) throw new Error(`Failed to fetch tenants: ${error.message}`)
    if (!tenants?.length) return { message: 'No active tenants to crawl' }

    const results = await Promise.allSettled(
      tenants.map((tenant) =>
        step.run(`crawl-${tenant.id}`, async () => {
          await runCrawl(tenant.id)
          return { tenantId: tenant.id, domain: tenant.domain }
        }),
      ),
    )

    const succeeded = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length

    return { succeeded, failed, total: tenants.length }
  },
)
