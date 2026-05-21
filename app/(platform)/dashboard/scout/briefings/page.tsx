import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkspace } from '@/lib/workspace/active'

export default async function BriefingsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const workspace = await getActiveWorkspace(userId)
  if (!workspace) redirect('/setup')

  const db = createAdminClient()
  const { data: briefings } = await db
    .from('scout_briefings')
    .select('id, week_starting, status, urgent_count, watch_count, wins_count, clem_suggestions_added, created_at')
    .eq('tenant_id', workspace.tenantId)
    .order('created_at', { ascending: false })
    .limit(52)

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 mb-6">Briefing archive</h1>

      {!briefings?.length ? (
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
          <p className="text-slate-500 text-sm">No briefings yet. Run Scout to generate your first briefing.</p>
          <Link href="/dashboard/scout" className="mt-3 inline-block text-sm text-indigo-600 hover:text-indigo-800 font-medium">
            Go to overview →
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
          {briefings.map((b) => (
            <Link
              key={b.id}
              href={`/dashboard/scout/briefings/${b.id}`}
              className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors"
            >
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-900">
                  Week of{' '}
                  {new Date(b.week_starting).toLocaleDateString('en-GB', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Generated {new Date(b.created_at ?? '').toLocaleDateString('en-GB')}
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500 shrink-0">
                {(b.urgent_count ?? 0) > 0 && (
                  <span className="text-red-600 font-medium">🔴 {b.urgent_count} urgent</span>
                )}
                {(b.watch_count ?? 0) > 0 && (
                  <span className="text-amber-600">🟡 {b.watch_count} watch</span>
                )}
                {(b.wins_count ?? 0) > 0 && (
                  <span className="text-green-600">🟢 {b.wins_count} wins</span>
                )}
                {(b.clem_suggestions_added ?? 0) > 0 && (
                  <span className="text-indigo-600">📝 {b.clem_suggestions_added} to Clem</span>
                )}
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    b.status === 'delivered'
                      ? 'bg-green-50 text-green-700'
                      : b.status === 'ready'
                      ? 'bg-indigo-50 text-indigo-700'
                      : b.status === 'failed'
                      ? 'bg-red-50 text-red-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {b.status}
                </span>
              </div>
              <span className="text-slate-300 ml-2">›</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
