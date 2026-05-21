'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ScoutConfig {
  enabled: boolean | null
  briefing_day: string | null
  briefing_time: string | null
  dataforseo_enabled: boolean | null
}

interface Props {
  initialConfig: ScoutConfig | null
  isAdmin: boolean
  hasDatasforSeoKey: boolean
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

export default function ScoutSettingsForm({ initialConfig, isAdmin, hasDatasforSeoKey }: Props) {
  const [enabled, setEnabled] = useState(initialConfig?.enabled ?? true)
  const [briefingDay, setBriefingDay] = useState(initialConfig?.briefing_day ?? 'monday')
  const [briefingTime, setBriefingTime] = useState(initialConfig?.briefing_time ?? '07:00')
  const [dataforseoEnabled, setDataforseoEnabled] = useState(initialConfig?.dataforseo_enabled ?? true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const res = await fetch('/api/scout/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          briefing_day: briefingDay,
          briefing_time: briefingTime,
          dataforseo_enabled: dataforseoEnabled,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Failed to save')
      } else {
        setSaved(true)
        router.refresh()
      }
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      {/* Enable/disable */}
      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Scout status</h2>
        <label className="flex items-center gap-3 cursor-pointer">
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => isAdmin && setEnabled(!enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              enabled ? 'bg-indigo-600' : 'bg-slate-200'
            } ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className="text-sm text-slate-700">
            {enabled ? 'Scout is enabled' : 'Scout is disabled'}
          </span>
        </label>
      </div>

      {/* Briefing schedule */}
      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Briefing schedule</h2>
        <p className="text-xs text-slate-500 mb-4">
          Scout generates and emails your weekly briefing on this schedule (UTC).
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Day</label>
            <select
              value={briefingDay}
              onChange={(e) => setBriefingDay(e.target.value)}
              disabled={!isAdmin}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 capitalize"
            >
              {DAYS.map((d) => (
                <option key={d} value={d} className="capitalize">
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Time (UTC)</label>
            <input
              type="time"
              value={briefingTime}
              onChange={(e) => setBriefingTime(e.target.value)}
              disabled={!isAdmin}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            />
          </div>
        </div>
      </div>

      {/* Data sources */}
      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Data sources</h2>

        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <div>
              <div className="text-sm font-medium text-slate-700">Firecrawl</div>
              <div className="text-xs text-slate-400">Competitor crawling and change detection</div>
            </div>
            <span className="text-xs text-green-600 font-medium">✓ Active</span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <div>
              <div className="text-sm font-medium text-slate-700">DataForSEO</div>
              <div className="text-xs text-slate-400">Keyword gaps, SERP features, PAA, trends</div>
            </div>
            {hasDatasforSeoKey ? (
              <label className="flex items-center gap-2 cursor-pointer">
                <button
                  type="button"
                  role="switch"
                  aria-checked={dataforseoEnabled}
                  onClick={() => isAdmin && setDataforseoEnabled(!dataforseoEnabled)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    dataforseoEnabled ? 'bg-indigo-600' : 'bg-slate-200'
                  } ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                      dataforseoEnabled ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </label>
            ) : (
              <span className="text-xs text-slate-400">Not configured</span>
            )}
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-sm font-medium text-slate-700">Google Search Console / GA4</div>
              <div className="text-xs text-slate-400">Own site traffic and ranking data (V2)</div>
            </div>
            <span className="text-xs text-slate-300 font-medium">Coming in V2</span>
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save settings'}
          </button>
          {saved && <span className="text-sm text-green-600">✓ Saved</span>}
          {error && <span className="text-sm text-red-500">{error}</span>}
        </div>
      )}
    </div>
  )
}
