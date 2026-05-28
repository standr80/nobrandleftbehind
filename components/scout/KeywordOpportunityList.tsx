'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Opportunity {
  id: string
  keyword: string
  search_volume: number | null
  keyword_difficulty: number | null
  opportunity_type: string | null
  competitor_ranking_url: string | null
  seasonal_peak_month: number | null
  weeks_until_peak: number | null
  status: string | null
  clem_suggestion_id: string | null
  discovered_at: string | null
  has_ai_overview: boolean | null
  ai_overview_snippet: string | null
}

interface Props {
  initialOpportunities: Opportunity[]
}

const TYPE_LABELS: Record<string, string> = {
  gap: 'Keyword gap',
  featured_snippet: 'Featured snippet',
  paa: 'People also ask',
  seasonal: 'Seasonal',
  rising_trend: 'Rising trend',
}

const TYPE_COLOURS: Record<string, string> = {
  gap: 'bg-purple-50 text-purple-700',
  featured_snippet: 'bg-blue-50 text-blue-700',
  paa: 'bg-teal-50 text-teal-700',
  seasonal: 'bg-orange-50 text-orange-700',
  rising_trend: 'bg-green-50 text-green-700',
}

const STATUS_FILTER_OPTIONS = ['all', 'pending', 'sent_to_clem', 'dismissed'] as const

export default function KeywordOpportunityList({ initialOpportunities }: Props) {
  const [opportunities, setOpportunities] = useState(initialOpportunities)
  const [filter, setFilter] = useState<(typeof STATUS_FILTER_OPTIONS)[number]>('pending')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const router = useRouter()

  const types = ['all', ...Array.from(new Set(opportunities.map((o) => o.opportunity_type ?? 'gap')))]

  const filtered = opportunities.filter((o) => {
    if (filter !== 'all' && o.status !== filter) return false
    if (typeFilter !== 'all' && o.opportunity_type !== typeFilter) return false
    return true
  })

  async function updateStatus(id: string, status: string) {
    setActionLoading(id)
    try {
      const res = await fetch(`/api/scout/keywords/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        setOpportunities((prev) =>
          prev.map((o) => (o.id === id ? { ...o, status } : o))
        )
        router.refresh()
      }
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex gap-1">
          {STATUS_FILTER_OPTIONS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors capitalize ${
                filter === f
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'
              }`}
            >
              {f === 'sent_to_clem' ? 'In Clem queue' : f}
            </button>
          ))}
        </div>
        {types.length > 2 && (
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-full px-3 py-1.5 bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {types.map((t) => (
              <option key={t} value={t}>
                {t === 'all' ? 'All types' : TYPE_LABELS[t] ?? t}
              </option>
            ))}
          </select>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
          <p className="text-slate-400 text-sm">No opportunities found for the selected filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
          {filtered.map((opp) => {
            const type = opp.opportunity_type ?? 'gap'
            return (
              <div key={opp.id} className="flex items-center gap-4 px-5 py-4">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${TYPE_COLOURS[type] ?? 'bg-slate-100 text-slate-600'}`}
                >
                  {TYPE_LABELS[type] ?? type}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900 truncate">{opp.keyword}</span>
                    {opp.has_ai_overview && (
                      <span
                        title="Google shows an AI Overview for this keyword. Structured Q&A format recommended."
                        className="text-xs px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 font-medium cursor-help shrink-0"
                      >
                        🤖 AI Overview
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3 mt-0.5 text-xs text-slate-400">
                    {opp.search_volume != null && (
                      <span>{opp.search_volume.toLocaleString()} / mo</span>
                    )}
                    {opp.keyword_difficulty != null && (
                      <span>KD {opp.keyword_difficulty}/100</span>
                    )}
                    {opp.weeks_until_peak != null && (
                      <span className="text-orange-600 font-medium">{opp.weeks_until_peak}w to peak</span>
                    )}
                    {opp.competitor_ranking_url && (
                      <a
                        href={opp.competitor_ranking_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-400 hover:text-indigo-600 truncate max-w-[180px]"
                      >
                        {opp.competitor_ranking_url}
                      </a>
                    )}
                  </div>
                </div>

                {opp.status === 'sent_to_clem' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-indigo-600 font-medium">✓ In Clem queue</span>
                    <button
                      onClick={() => updateStatus(opp.id, 'dismissed')}
                      disabled={actionLoading === opp.id}
                      title="Dismiss"
                      className="text-slate-300 hover:text-slate-500 transition-colors disabled:opacity-40"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z" />
                      </svg>
                    </button>
                  </div>
                )}
                {opp.status === 'dismissed' && (
                  <span className="text-xs text-slate-400 shrink-0">Dismissed</span>
                )}

                {opp.status === 'pending' && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => updateStatus(opp.id, 'dismissed')}
                      disabled={actionLoading === opp.id}
                      className="text-xs px-2 py-1 border border-slate-200 text-slate-500 rounded hover:border-red-200 hover:text-red-500 transition-colors disabled:opacity-50"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={() => updateStatus(opp.id, 'sent_to_clem')}
                      disabled={actionLoading === opp.id}
                      className="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                      {actionLoading === opp.id ? 'Adding…' : '+ Add to Clem'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
