import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkspace } from '@/lib/workspace/active'
import PamPlanner, { type PlannerPost, type PamItem } from '@/components/pam/PamPlanner'

export default async function PamPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const workspace = await getActiveWorkspace(userId)
  if (!workspace) redirect('/setup')

  const db = createAdminClient()
  const since = new Date()
  since.setMonth(since.getMonth() - 4)

  const [{ data: posts }, { data: items }] = await Promise.all([
    db
      .from('blog_posts')
      .select('id, title, content_type, status, published_at, scheduled_for')
      .eq('tenant_id', workspace.tenantId)
      .is('deleted_at', null)
      .or(`published_at.gte.${since.toISOString()},scheduled_for.gte.${since.toISOString()}`)
      .order('published_at', { ascending: false })
      .limit(200),
    db
      .from('pam_items')
      .select(
        'id, kind, item_type, title, note, reason, status, scheduled_for, snoozed_until, source, target_post_id, suggestion_id, created_at',
      )
      .eq('tenant_id', workspace.tenantId)
      .neq('status', 'dismissed')
      .order('created_at', { ascending: false }),
  ])

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 mb-2">Pam — content planner</h1>
      <p className="text-sm text-slate-500 mb-6">
        Pam keeps the editorial calendar: what was published, what&apos;s scheduled, your ideas,
        and — once her engine runs — recommendations for new and refreshed content, each with a
        reason. Accepted work flows to Clem and Bailey through the normal review process.
      </p>
      <PamPlanner
        key={workspace.tenantId}
        tenantId={workspace.tenantId}
        initialPosts={(posts ?? []) as PlannerPost[]}
        initialItems={(items ?? []) as PamItem[]}
      />
    </div>
  )
}
