import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import SettingsForm from './SettingsForm'

export default async function SettingsPage() {
  const { userId } = await auth()
  if (!userId) return null

  const db = createAdminClient()

  const { data: membership } = await db
    .from('tenant_members')
    .select('tenant_id, role, tenants(*)')
    .eq('clerk_user_id', userId)
    .maybeSingle()

  if (!membership) redirect('/setup')

  const tenant = Array.isArray(membership.tenants) ? membership.tenants[0] : membership.tenants
  if (!tenant) redirect('/setup')

  const { data: members } = await db
    .from('tenant_members')
    .select('id, name, email, role, clerk_user_id, created_at')
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: true })

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Workspace settings</h1>
        <p className="text-white/40 text-sm">{tenant.domain}</p>
      </div>
      <SettingsForm
        tenant={tenant}
        members={members ?? []}
        isAdmin={membership.role === 'admin'}
      />
    </div>
  )
}
