import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import SetupWizard from './SetupWizard'

export default async function SetupPage() {
  const { userId } = await auth()
  if (!userId) return null

  const db = createAdminClient()
  const { data: membership } = await db
    .from('tenant_members')
    .select('tenant_id, role')
    .eq('clerk_user_id', userId)
    .maybeSingle()

  // Already has a tenant — redirect to settings
  if (membership) redirect('/settings')

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Set up your workspace</h1>
        <p className="text-white/40 text-sm">
          Tell Clem about your website so it can write content that sounds like you.
        </p>
      </div>
      <SetupWizard />
    </div>
  )
}
