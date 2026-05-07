import { createAdminClient } from '../supabase/admin'

const DAY_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

/**
 * Calculates the next available publish slot for a tenant based on
 * their publish_days and publish_time config, skipping days already
 * taken by scheduled or published posts.
 */
export async function calculateNextSlot(tenantId: string): Promise<Date> {
  const db = createAdminClient()

  const { data: tenant, error } = await db
    .from('tenants')
    .select('publish_days, publish_time')
    .eq('id', tenantId)
    .single()

  if (error || !tenant) throw new Error(`Tenant ${tenantId} not found`)

  const { data: occupied } = await db
    .from('blog_posts')
    .select('scheduled_for')
    .eq('tenant_id', tenantId)
    .in('status', ['scheduled', 'published'])
    .not('scheduled_for', 'is', null)

  const takenDates = new Set(
    (occupied ?? [])
      .map((p) => p.scheduled_for?.split('T')[0])
      .filter(Boolean) as string[],
  )

  const publishDays = (tenant.publish_days ?? ['tuesday', 'thursday']).map(
    (d: string) => DAY_MAP[d.toLowerCase()] ?? 2,
  )

  const [hours, minutes] = (tenant.publish_time ?? '09:00').split(':').map(Number)

  // Start searching from tomorrow
  const candidate = new Date()
  candidate.setDate(candidate.getDate() + 1)
  candidate.setHours(hours, minutes, 0, 0)

  for (let i = 0; i < 90; i++) {
    const dayOfWeek = candidate.getDay()
    const dateStr = candidate.toISOString().split('T')[0]

    if (publishDays.includes(dayOfWeek) && !takenDates.has(dateStr)) {
      return new Date(candidate)
    }

    candidate.setDate(candidate.getDate() + 1)
  }

  throw new Error('No available scheduling slot found within 90 days')
}
