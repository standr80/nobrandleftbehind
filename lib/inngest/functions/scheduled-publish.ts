import { inngest } from '../client'

// Sprint 4 — implemented in lib/clem/publish.ts
export const scheduledPublish = inngest.createFunction(
  {
    id: 'scheduled-publish',
    name: 'Scheduled Post Publisher',
    triggers: [{ event: 'clem/post.scheduled' }],
  },
  async () => {
    // TODO Sprint 4: pull post from DB, create GitHub PR or direct-publish
    throw new Error('Not yet implemented — Sprint 4')
  },
)
