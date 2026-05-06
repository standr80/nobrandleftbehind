import { inngest } from '../client'

// Sprint 2 — implemented in lib/clem/suggest.ts
export const weeklySuggest = inngest.createFunction(
  {
    id: 'weekly-suggest',
    name: 'Weekly Topic Suggestions',
    triggers: [{ cron: '0 6 * * 1' }], // every Monday at 06:00 UTC
  },
  async () => {
    // TODO Sprint 2: iterate tenants, run suggest() for each
    throw new Error('Not yet implemented — Sprint 2')
  },
)
