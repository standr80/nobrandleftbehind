import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkspace } from '@/lib/workspace/active'
import AuthorsManager, { type Author } from './AuthorsManager'

export default async function AuthorsPage() {
  const { userId } = await auth()
  if (!userId) return null

  const workspace = await getActiveWorkspace(userId)
  if (!workspace) redirect('/setup')

  const { tenant, role } = workspace
  const db = createAdminClient()

  const { data: authors } = await db
    .from('authors')
    .select('id, name, slug, job_title, bio, links, is_default, created_at')
    .eq('tenant_id', tenant.id)
    .order('name', { ascending: true })

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href="/settings" className="text-sm text-slate-400 hover:text-slate-900 transition-colors inline-flex items-center gap-1">
          ← Settings
        </Link>
      </div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Authors</h1>
        <p className="text-slate-400 text-sm">
          Named authors for {tenant.name}. Attribute articles to a real person with a bio and
          credentials to strengthen Google E-E-A-T. Authors don&apos;t need a login.
        </p>
      </div>
      <AuthorsManager
        key={tenant.id}
        initialAuthors={(authors as unknown as Author[]) ?? []}
        isAdmin={role === 'admin'}
        tenantId={tenant.id}
      />
    </div>
  )
}
