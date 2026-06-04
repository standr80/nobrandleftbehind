'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import RankSparkline from './RankSparkline'

type RankHistory = Record<string, { date: string; position: number | null }[]>

const LOCATION_LABELS: Record<number, string> = {
  2826: 'UK', 2840: 'US', 2372: 'Ireland', 2036: 'Australia', 2124: 'Canada',
  2554: 'New Zealand', 2276: 'Germany', 2250: 'France', 2724: 'Spain', 2380: 'Italy', 2528: 'Netherlands',
}
const locationLabel = (code: number) => LOCATION_LABELS[code] ?? `Loc ${code}`

interface RankRow {
  keyword: string
  position: number | null
  previous_position: number | null
  position_change: number | null
  url: string | null
  search_volume: number | null
  snapshot_date: string
  branded?: boolean
}

type BrandFilter = 'all' | 'nonbranded' | 'branded'

interface Summary {
  improved: number
  declined: number
  enteredTop10: number
  rankedKeywords: number
  avgPosition: number | null
  top3: number
  top10: number
  rankedPages: number
  visibilityScore: number | null
  snapshotDate: string
}

export default function RankTracker({ tenantId }: { tenantId: string }) {
  const [rows, setRows] = useState<RankRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [history, setHistory] = useState<RankHistory>({})
  const [loading, setLoading] = useState(true)
  const [locations, setLocations] = useState<number[]>([])
  const [location, setLocation] = useState<number | null>(null)
  const [devices, setDevices] = useState<string[]>([])
  const [device, setDevice] = useState<string | null>(null)
  const [brandFilter, setBrandFilter] = useState<BrandFilter>('all')
  const [briefingLoading, setBriefingLoading] = useState<string | null>(null)
  const [briefResult, setBriefResult] = useState<
    Record<string, { ok: boolean; alreadyExists?: boolean; error?: string }>
  >({})
  const router = useRouter()

  // tenantId is used by the server-side API but included as a prop for future filtering
  void tenantId

  useEffect(() => {
    setLoading(true)
    const qs = new URLSearchParams()
    if (location !== null) qs.set('location', String(location))
    if (device !== null) qs.set('device', device)
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    fetch(`/api/scout/ranks${suffix}`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d.rows ?? [])
        setSummary(d.summary ?? null)
        setHistory(d.history ?? {})
        setLocations(d.locations ?? [])
        setDevices(d.devices ?? [])
        if (location === null && d.location != null) setLocation(d.location)
        if (device === null && d.device != null) setDevice(d.device)
      })
      .finally(() => setLoading(false))
  }, [location, device])

  async function briefClem(row: RankRow) {
    setBriefingLoading(row.keyword)
    try {
      const res = await fetch('/api/scout/keywords/brief-clem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: row.keyword,
          position: row.position,
          search_volume: row.search_volume,
          position_change: row.position_change,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setBriefResult((prev) => ({
          ...prev,
          [row.keyword]: { ok: true, alreadyExists: !!data.alreadyExists },
        }))
        router.refresh()
      } else {
        setBriefResult((prev) => ({
          ...prev,
          [row.keyword]: { ok: false, error: data.error ?? 'Failed' },
        }))
      }
    } catch {
      setBriefResult((prev) => ({ ...prev, [row.keyword]: { ok: false, error: 'Network error' } }))
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

  const locationToggle = locations.length > 1 && location !== null && (
    <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit">
      {locations.map((code) => (
        <button
          key={code}
          onClick={() => setLocation(code)}
          className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
            code === location ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {locationLabel(code)}
        </button>
      ))}
    </div>
  )

  const deviceToggle = devices.length > 1 && device !== null && (
    <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit">
      {devices.map((d) => (
        <button
          key={d}
          onClick={() => setDevice(d)}
          className={`text-xs px-3 py-1.5 rounded-md font-medium capitalize transition-colors ${
            d === device ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {d === 'desktop' ? '🖥 Desktop' : d === 'mobile' ? '📱 Mobile' : d}
        </button>
      ))}
    </div>
  )

  // Only block the whole panel on the very first load.
  if (loading && location === null)
    return <div className="text-sm text-slate-400">Loading rank data…</div>

  if (!rows.length)
    return (
      <div className="space-y-4">
        {(locationToggle || deviceToggle) && (
          <div className="flex flex-wrap items-center gap-3">
            {locationToggle}
            {deviceToggle}
          </div>
        )}
        <div className="text-sm text-slate-400">
          No rank history yet for {location !== null ? locationLabel(location) : 'this workspace'}.
          Run Scout to capture a snapshot.
        </div>
      </div>
    )

  const rankingCount = rows.filter((r) => r.position !== null).length
  const hasRankingData = rankingCount > 0
  const hasBrandData = rows.some((r) => r.branded)
  const displayRows =
    brandFilter === 'all'
      ? rows
      : rows.filter((r) => (brandFilter === 'branded' ? r.branded : !r.branded))

  const brandToggle = hasBrandData && (
    <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit">
      {([
        ['all', 'All'],
        ['nonbranded', 'Non-branded'],
        ['branded', 'Branded'],
      ] as [BrandFilter, string][]).map(([key, label]) => (
        <button
          key={key}
          onClick={() => setBrandFilter(key)}
          className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
            brandFilter === key ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )

  return (
    <div className="space-y-4">
      {(locationToggle || deviceToggle || brandToggle) && (
        <div className="flex flex-wrap items-center gap-3">
          {locationToggle}
          {deviceToggle}
          {brandToggle}
        </div>
      )}
      {hasRankingData ? (
        summary && (
          <div className="space-y-3">
            {/* Visibility metrics */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-indigo-700">
                  {summary.visibilityScore !== null ? `${summary.visibilityScore}%` : '—'}
                </div>
                <div className="text-xs text-indigo-600" title="Share of available search demand captured, weighted by position and volume">
                  visibility
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-slate-800">{summary.avgPosition ?? '—'}</div>
                <div className="text-xs text-slate-500">avg position</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-slate-800">{summary.top3}</div>
                <div className="text-xs text-slate-500">in top 3</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-slate-800">{summary.top10}</div>
                <div className="text-xs text-slate-500">in top 10</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-slate-800">{summary.rankedPages}</div>
                <div className="text-xs text-slate-500">ranked pages</div>
              </div>
            </div>
            {/* Movement */}
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
          </div>
        )
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm font-medium text-amber-800">No ranking positions found yet</p>
          <p className="text-sm text-amber-700 mt-1 leading-relaxed">
            We couldn&apos;t find any keywords this domain currently ranks for in the top 100.
            This is normal for newer or lower-traffic sites — positions will appear here as the
            site builds search visibility. The keywords below are opportunities Scout is tracking
            for you to target.
          </p>
        </div>
      )}

      {hasRankingData && (
        <p className="text-xs text-slate-400">
          Tracking {rows.length} keyword{rows.length !== 1 ? 's' : ''} · {rankingCount} ranking in the top 100
        </p>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">Keyword</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-slate-500 w-20">Position</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-slate-500 w-20">Change</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-slate-500 w-28">Trend</th>
              <th className="text-right px-3 py-2.5 text-xs font-medium text-slate-500 w-24">Volume</th>
              <th className="text-right px-3 py-2.5 text-xs font-medium text-slate-500 w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayRows.map((row) => {
              const isTop10 = row.position !== null && row.position <= 10
              const isNewTop10 =
                isTop10 && (row.previous_position === null || row.previous_position > 10)
              const isNearRanking =
                row.position !== null && row.position >= 4 && row.position <= 20
              // A keyword that slipped is worth acting on regardless of how far
              // down it sits — a declining position with real volume is a signal.
              const isDeclining =
                row.position_change !== null && row.position_change < 0
              const isActionable = isNearRanking || isDeclining
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
                  <td className="px-3 py-2.5 text-center">
                    <RankSparkline history={history[row.keyword] ?? []} />
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-400 text-xs">
                    {row.search_volume != null ? row.search_volume.toLocaleString() : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {(() => {
                      const result = briefResult[row.keyword]
                      if (result?.ok) {
                        return (
                          <span className="text-xs text-green-600 font-medium" title="View in Clem's queue">
                            {result.alreadyExists ? '✓ Already queued' : '✓ Added to Clem'}
                          </span>
                        )
                      }
                      if (result && !result.ok) {
                        return (
                          <button
                            onClick={() => briefClem(row)}
                            disabled={briefingLoading === row.keyword}
                            className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 disabled:opacity-50 transition-colors"
                            title={result.error}
                          >
                            {briefingLoading === row.keyword ? '…' : 'Retry'}
                          </button>
                        )
                      }
                      if (isActionable) {
                        return (
                          <button
                            onClick={() => briefClem(row)}
                            disabled={briefingLoading === row.keyword}
                            title={isDeclining && !isNearRanking ? 'This keyword is declining — brief Clem to defend it' : undefined}
                            className="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                          >
                            {briefingLoading === row.keyword ? '…' : 'Brief Clem'}
                          </button>
                        )
                      }
                      return null
                    })()}
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
