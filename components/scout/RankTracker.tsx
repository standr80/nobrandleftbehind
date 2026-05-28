'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface RankRow {
  keyword: string
  position: number | null
  previous_position: number | null
  position_change: number | null
  url: string | null
  search_volume: number | null
  snapshot_date: string
}

interface Summary {
  improved: number
  declined: number
  enteredTop10: number
  snapshotDate: string
}

export default function RankTracker({ tenantId }: { tenantId: string }) {
  const [rows, setRows] = useState<RankRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [briefingLoading, setBriefingLoading] = useState<string | null>(null)
  const router = useRouter()

  // tenantId is used by the server-side API but included as a prop for future filtering
  void tenantId

  useEffect(() => {
    fetch('/api/scout/ranks')
      .then((r) => r.json())
      .then((d) => {
        setRows(d.rows ?? [])
        setSummary(d.summary ?? null)
      })
      .finally(() => setLoading(false))
  }, [])

  async function briefClem(row: RankRow) {
    setBriefingLoading(row.keyword)
    try {
      await fetch('/api/scout/keywords/brief-clem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: row.keyword,
          position: row.position,
          search_volume: row.search_volume,
        }),
      })
      router.refresh()
    } finally {
      setBriefingLoading(null)
    }
  }

  function changeDisplay(change: number | null) {
    if (change === null || change === 0) return <span className="text-slate-400">—</span>
    if (change > 0)
      return <span className="text-green-600 font-medium">↑ {change}</span>
    return <span className="text-red-500 font-medium">↓ {Math.abs(change)}</span>
  }

  if (loading) return <div className="text-sm text-slate-400">Loading rank data…</div>
  if (!rows.length)
    return (
      <div className="text-sm text-slate-400">
        No rank history yet. Run Scout to capture a snapshot.
      </div>
    )

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-green-700">↑ {summary.improved}</div>
            <div className="text-xs text-green-600">improved</div>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-red-600">↓ {summary.declined}</div>
            <div className="text-xs text-red-500">declined</div>
          </div>
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-indigo-700">★ {summary.enteredTop10}</div>
            <div className="text-xs text-indigo-600">new top 10</div>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">Keyword</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-slate-500 w-20">Position</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-slate-500 w-20">Change</th>
              <th className="text-right px-3 py-2.5 text-xs font-medium text-slate-500 w-24">Volume</th>
              <th className="text-right px-3 py-2.5 text-xs font-medium text-slate-500 w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const isTop10 = row.position !== null && row.position <= 10
              const isNewTop10 =
                isTop10 && (row.previous_position === null || row.previous_position > 10)
              const isNearRanking =
                row.position !== null && row.position >= 4 && row.position <= 20
              return (
                <tr
                  key={row.keyword}
                  className={isNewTop10 ? 'bg-green-50' : ''}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-800">{row.keyword}</span>
                      {isNewTop10 && (
                        <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-medium">
                          New ↑
                        </span>
                      )}
                    </div>
                    {row.url && (
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-slate-400 hover:text-indigo-600 truncate block max-w-xs"
                      >
                        {row.url}
                      </a>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {row.position !== null ? (
                      <span className={`font-medium ${isTop10 ? 'text-green-700' : 'text-slate-700'}`}>
                        {row.position}
                      </span>
                    ) : (
                      <span className="text-slate-300" title="Not ranking in top 100">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">{changeDisplay(row.position_change)}</td>
                  <td className="px-3 py-2.5 text-right text-slate-400 text-xs">
                    {row.search_volume != null ? row.search_volume.toLocaleString() : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {isNearRanking && (
                      <button
                        onClick={() => briefClem(row)}
                        disabled={briefingLoading === row.keyword}
                        className="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                      >
                        {briefingLoading === row.keyword ? '…' : 'Brief Clem'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {summary?.snapshotDate && (
        <p className="text-xs text-slate-400 text-right">
          Snapshot: {new Date(summary.snapshotDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      )}
    </div>
  )
}
