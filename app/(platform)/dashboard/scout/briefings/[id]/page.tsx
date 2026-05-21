import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkspace } from '@/lib/workspace/active'

interface Props {
  params: Promise<{ id: string }>
}

export default async function BriefingDetailPage({ params }: Props) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const workspace = await getActiveWorkspace(userId)
  if (!workspace) redirect('/setup')

  const db = createAdminClient()
  const { data: briefing } = await db
    .from('scout_briefings')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', workspace.tenantId)
    .single()

  if (!briefing) notFound()

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/scout/briefings" className="text-sm text-slate-400 hover:text-slate-600">
          ← All briefings
        </Link>
        <span className="text-slate-200">|</span>
        <h1 className="text-lg font-semibold text-slate-900">
          Week of{' '}
          {new Date(briefing.week_starting).toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </h1>
        <span
          className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${
            briefing.status === 'delivered'
              ? 'bg-green-50 text-green-700'
              : briefing.status === 'ready'
              ? 'bg-indigo-50 text-indigo-700'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          {briefing.status}
        </span>
      </div>

      {/* Render the stored HTML briefing in a sandboxed iframe-like container */}
      {briefing.briefing_html ? (
        <div
          className="bg-white rounded-lg border border-slate-200 overflow-hidden"
          dangerouslySetInnerHTML={{ __html: briefing.briefing_html }}
        />
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
          <p className="text-slate-400 text-sm">Briefing content is not available.</p>
        </div>
      )}
    </div>
  )
}
