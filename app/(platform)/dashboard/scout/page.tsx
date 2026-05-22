import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkspace } from '@/lib/workspace/active'
import ScoutRunButton from '@/components/scout/ScoutRunButton'

async function getScoutOverview(tenantId: string) {
  const db = createAdminClient()

  const [configRes, tenantRes, latestBriefingRes, alertsRes, opportunitiesRes] =
    await Promise.all([
      db.from('scout_config').select('*').eq('tenant_id', tenantId).maybeSingle(),
      db.from('tenants').select('reference_urls').eq('id', tenantId).single(),
      db
        .from('scout_briefings')
        .select('id, week_starting, status, urgent_count, watch_count, wins_count, clem_suggestions_added, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from('scout_alerts')
        .select('id, alert_type, severity, title, detail, created_at')
        .eq('tenant_id', tenantId)
        .eq('actioned', false)
        .order('created_at', { ascending: false })
        .limit(10),
      db
        .from('scout_keyword_opportunities')
        .select('id, keyword, search_volume, opportunity_type, status')
        .eq('tenant_id', tenantId)
        .eq('status', 'pending')
        .order('discovered_at', { ascending: false })
        .limit(5),
    ])

  // Combined competitor list — same logic as schedule.ts
  const clemUrls: string[] = tenantRes.data?.reference_urls ?? []
  const scoutUrls: string[] = configRes.data?.competitor_urls ?? []
  const allCompetitorUrls = [...clemUrls, ...scoutUrls.filter((u) => !clemUrls.includes(u))].slice(0, 5)

  return {
    config: configRes.data,
    allCompetitorUrls,
    latestBriefing: latestBriefingRes.data,
    alerts: alertsRes.data ?? [],
    pendingOpportunities: opportunitiesRes.data ?? [],
  }
}

export default async function ScoutOverviewPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const workspace = await getActiveWorkspace(userId)
  if (!workspace) redirect('/setup')

  const { allCompetitorUrls, latestBriefing, alerts, pendingOpportunities } =
    await getScoutOverview(workspace.tenantId)

  const urgentAlerts = alerts.filter((a) => a.severity === 'urgent')
  const watchAlerts = alerts.filter((a) => a.severity === 'watch')
  const isAdmin = workspace.role === 'admin'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Scout</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Market intelligence for {workspace.tenant.name}
          </p>
        </div>
        {isAdmin && (
          <ScoutRunButton />
        )}
      </div>

      {/* No config warning */}
      {allCompetitorUrls.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-amber-800 font-medium">Scout is ready but needs configuration.</p>
          <p className="text-sm text-amber-700 mt-1">
            Add competitor URLs in{' '}
            <Link href="/settings" className="underline font-medium">Clem Settings</Link>
            {' '}or{' '}
            <Link href="/dashboard/scout/competitors" className="underline font-medium">Scout Competitors</Link>
            {' '}to start monitoring.
          </p>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Competitors monitored', value: allCompetitorUrls.length, href: '/dashboard/scout/competitors' },
          { label: 'Unactioned alerts', value: alerts.length, accent: urgentAlerts.length > 0 },
          { label: 'Pending opportunities', value: pendingOpportunities.length, href: '/dashboard/scout/keywords' },
          {
            label: 'Latest briefing',
            value: latestBriefing
              ? new Date(latestBriefing.week_starting).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
              : '—',
            href: latestBriefing ? `/dashboard/scout/briefings/${latestBriefing.id}` : '/dashboard/scout/briefings',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`bg-white rounded-lg border p-4 ${stat.accent ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
          >
            {stat.href ? (
              <Link href={stat.href} className="block">
                <div className={`text-2xl font-bold ${stat.accent ? 'text-red-600' : 'text-slate-900'}`}>
                  {stat.value}
                </div>
                <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
              </Link>
            ) : (
              <>
                <div className={`text-2xl font-bold ${stat.accent ? 'text-red-600' : 'text-slate-900'}`}>
                  {stat.value}
                </div>
                <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Alerts */}
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Active alerts</h2>
          {alerts.length === 0 ? (
            <p className="text-sm text-slate-400">No active alerts.</p>
          ) : (
            <div className="space-y-3">
              {urgentAlerts.map((alert) => (
                <div key={alert.id} className="flex gap-3 p-3 bg-red-50 border border-red-100 rounded-lg">
                  <span className="text-base leading-none mt-0.5">🔴</span>
                  <div>
                    <div className="text-sm font-medium text-slate-900">{alert.title}</div>
                    {alert.detail && <div className="text-xs text-slate-500 mt-0.5">{alert.detail}</div>}
                  </div>
                </div>
              ))}
              {watchAlerts.map((alert) => (
                <div key={alert.id} className="flex gap-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                  <span className="text-base leading-none mt-0.5">🟡</span>
                  <div>
                    <div className="text-sm font-medium text-slate-900">{alert.title}</div>
                    {alert.detail && <div className="text-xs text-slate-500 mt-0.5">{alert.detail}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Latest briefing summary */}
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Latest briefing</h2>
          {!latestBriefing ? (
            <p className="text-sm text-slate-400">No briefings yet. Run Scout to generate your first briefing.</p>
          ) : (
            <div>
              <div className="text-xs text-slate-400 mb-3">
                Week of {new Date(latestBriefing.week_starting).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
              <div className="grid grid-cols-4 gap-3 mb-4">
                {[
                  { label: 'Urgent', value: latestBriefing.urgent_count ?? 0, color: 'text-red-600' },
                  { label: 'Watch', value: latestBriefing.watch_count ?? 0, color: 'text-amber-600' },
                  { label: 'Wins', value: latestBriefing.wins_count ?? 0, color: 'text-green-600' },
                  { label: 'Clem queue', value: latestBriefing.clem_suggestions_added ?? 0, color: 'text-indigo-600' },
                ].map((item) => (
                  <div key={item.label} className="text-center">
                    <div className={`text-xl font-bold ${item.color}`}>{item.value}</div>
                    <div className="text-xs text-slate-400">{item.label}</div>
                  </div>
                ))}
              </div>
              <Link
                href={`/dashboard/scout/briefings/${latestBriefing.id}`}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
              >
                Read full briefing →
              </Link>
            </div>
          )}
        </div>

        {/* Pending keyword opportunities */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">Keyword opportunities</h2>
            <Link href="/dashboard/scout/keywords" className="text-xs text-indigo-600 hover:text-indigo-800">
              View all →
            </Link>
          </div>
          {pendingOpportunities.length === 0 ? (
            <p className="text-sm text-slate-400">No pending opportunities. Run Scout to discover some.</p>
          ) : (
            <div className="space-y-2">
              {pendingOpportunities.map((opp) => (
                <div key={opp.id} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium capitalize shrink-0">
                    {(opp.opportunity_type ?? 'gap').replace(/_/g, ' ')}
                  </span>
                  <span className="text-sm text-slate-700 flex-1">{opp.keyword}</span>
                  {opp.search_volume ? (
                    <span className="text-xs text-slate-400 shrink-0">{opp.search_volume.toLocaleString()} / mo</span>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
