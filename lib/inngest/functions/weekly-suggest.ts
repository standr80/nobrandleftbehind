import { inngest } from '../client'
import { createAdminClient } from '../../supabase/admin'
import { runSuggestions } from '../../clem/suggest'

export const weeklySuggest = inngest.createFunction(
  {
    id: 'weekly-suggest',
    name: 'Weekly Topic Suggestions',
    triggers: [{ cron: '0 6 * * 1' }], // every Monday at 06:00 UTC (after crawl)
  },
  async ({ step }) => {
    const db = createAdminClient()

    const { data: tenants, error } = await db
      .from('tenants')
      .select('id, name, domain')
      .eq('post_cadence_active', true)

    if (error) throw new Error(`Failed to fetch tenants: ${error.message}`)
    if (!tenants?.length) return { message: 'No active tenants' }

    const results = await Promise.allSettled(
      tenants.map((tenant) =>
        step.run(`suggest-${tenant.id}`, async () => {
          await runSuggestions(tenant.id)
          return { tenantId: tenant.id, name: tenant.name }
        }),
      ),
    )

    const succeeded = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length

    return { succeeded, failed, total: tenants.length }
  },
)
