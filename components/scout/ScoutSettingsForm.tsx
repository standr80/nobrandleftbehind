'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ScoutConfig {
  enabled: boolean | null
  auto_run_enabled: boolean | null
  briefing_day: string | null
  briefing_time: string | null
  dataforseo_enabled: boolean | null
  track_competitors: boolean | null
  track_keywords: boolean | null
  track_rankings: boolean | null
  rank_alert_threshold: number | null
  location_code: number | null
  rank_location_codes: number[] | null
  brand_terms: string[] | null
}

// Common DataForSEO Google location codes. Full list:
// https://docs.dataforseo.com/v3/serp/google/locations/
const LOCATIONS: { code: number; label: string }[] = [
  { code: 2826, label: 'United Kingdom (google.co.uk)' },
  { code: 2840, label: 'United States (google.com)' },
  { code: 2372, label: 'Ireland (google.ie)' },
  { code: 2036, label: 'Australia (google.com.au)' },
  { code: 2124, label: 'Canada (google.ca)' },
  { code: 2554, label: 'New Zealand (google.co.nz)' },
  { code: 2276, label: 'Germany (google.de)' },
  { code: 2250, label: 'France (google.fr)' },
  { code: 2724, label: 'Spain (google.es)' },
  { code: 2380, label: 'Italy (google.it)' },
  { code: 2528, label: 'Netherlands (google.nl)' },
]

interface Props {
  initialConfig: ScoutConfig | null
  hasDatasforSeoKey: boolean
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

export default function ScoutSettingsForm({ initialConfig, hasDatasforSeoKey }: Props) {
  const [enabled, setEnabled] = useState(initialConfig?.enabled ?? true)
  const [autoRunEnabled, setAutoRunEnabled] = useState(initialConfig?.auto_run_enabled ?? false)
  const [briefingDay, setBriefingDay] = useState(initialConfig?.briefing_day ?? 'monday')
  const [briefingTime, setBriefingTime] = useState(initialConfig?.briefing_time ?? '07:00')
  const [dataforseoEnabled, setDataforseoEnabled] = useState(initialConfig?.dataforseo_enabled ?? true)
  const [trackCompetitors, setTrackCompetitors] = useState(initialConfig?.track_competitors ?? true)
  const [trackKeywords, setTrackKeywords] = useState(initialConfig?.track_keywords ?? true)
  const [trackRankings, setTrackRankings] = useState(initialConfig?.track_rankings ?? true)
  const [rankAlertThreshold, setRankAlertThreshold] = useState(initialConfig?.rank_alert_threshold ?? 5)
  const [locationCode, setLocationCode] = useState(initialConfig?.location_code ?? 2826)
  const [rankLocations, setRankLocations] = useState<number[]>(
    initialConfig?.rank_location_codes ?? [initialConfig?.location_code ?? 2826],
  )
  const [brandTerms, setBrandTerms] = useState((initialConfig?.brand_terms ?? []).join(', '))

  // The primary location is always tracked for rankings.
  const rankSet = new Set<number>([locationCode, ...rankLocations])
  function toggleRankLocation(code: number) {
    setRankLocations((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      next.add(locationCode) // never drop the primary
      return Array.from(next)
    })
  }
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
          auto_run_enabled: autoRunEnabled,
          briefing_day: briefingDay,
          briefing_time: briefingTime,
          dataforseo_enabled: dataforseoEnabled,
          track_competitors: trackCompetitors,
          track_keywords: trackKeywords,
          track_rankings: trackRankings,
          rank_alert_threshold: rankAlertThreshold,
          location_code: locationCode,
          rank_location_codes: Array.from(new Set([locationCode, ...rankLocations])),
          brand_terms: brandTerms.split(',').map((t) => t.trim()).filter(Boolean),
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
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              enabled ? 'bg-indigo-600' : 'bg-slate-200'
            }`}
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
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Automatic weekly run</h2>

        <label className="flex items-start gap-3 cursor-pointer mb-4">
          <button
            type="button"
            role="switch"
            aria-checked={autoRunEnabled}
            aria-label="Automatic weekly run"
            onClick={() => setAutoRunEnabled(!autoRunEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 mt-0.5 ${
              autoRunEnabled ? 'bg-indigo-600' : 'bg-slate-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                autoRunEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className="text-sm text-slate-700">
            {autoRunEnabled ? 'Scout runs automatically every week' : 'Automatic weekly run is off'}
            <span className="block text-xs text-slate-400 mt-0.5">
              When off, Scout only runs when you click “Run Scout”. Automatic runs use paid
              competitor-crawling and keyword APIs, so this is off by default.
            </span>
          </span>
        </label>

        <p className="text-xs text-slate-500 mb-4 pt-4 border-t border-slate-100">
          When automatic runs are on, Scout generates and emails your briefing on this schedule (UTC).
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Day</label>
            <select
              value={briefingDay}
              onChange={(e) => setBriefingDay(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 capitalize"
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
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Search location */}
      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Search location</h2>
        <p className="text-xs text-slate-500 mb-4">
          The Google region Scout tracks rankings and keyword data against. Choose the country your
          audience searches from.
        </p>
        <select
          value={locationCode}
          onChange={(e) => setLocationCode(Number(e.target.value))}
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {LOCATIONS.map((loc) => (
            <option key={loc.code} value={loc.code}>
              {loc.label}
            </option>
          ))}
        </select>
        {!LOCATIONS.some((l) => l.code === locationCode) && (
          <p className="text-xs text-amber-600 mt-2">
            Current location code {locationCode} isn&apos;t in the list — saving will keep it unless you pick another.
          </p>
        )}

        {/* Additional rank-tracking markets */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Track rankings in additional markets
          </label>
          <p className="text-xs text-slate-400 mb-3">
            Capture rank snapshots in more than one country. Keyword research still uses the primary
            location above. Each extra market adds a small amount of DataForSEO usage per run.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {LOCATIONS.map((loc) => {
              const isPrimary = loc.code === locationCode
              const checked = rankSet.has(loc.code)
              return (
                <label
                  key={loc.code}
                  className={`flex items-center gap-2 text-sm rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                    checked ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'
                  } ${isPrimary ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isPrimary}
                    onChange={() => toggleRankLocation(loc.code)}
                    className="accent-indigo-600"
                  />
                  <span className="text-slate-700">{loc.label.replace(/ \(.*\)$/, '')}</span>
                  {isPrimary && <span className="text-xs text-slate-400 ml-auto">primary</span>}
                </label>
              )
            })}
          </div>
        </div>

        {/* Brand terms */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Brand terms</label>
          <p className="text-xs text-slate-400 mb-2">
            Comma-separated. Keywords containing any of these are tagged “branded” so you can filter
            them out of rank reports. Your workspace name is always included automatically.
          </p>
          <input
            value={brandTerms}
            onChange={(e) => setBrandTerms(e.target.value)}
            placeholder="e.g. acme, acme prints, acmeshop"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Monitoring features */}
      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Monitoring</h2>
        <p className="text-xs text-slate-500 mb-4">
          Choose which checks Scout runs each week. Disabling one skips it entirely for this workspace.
        </p>

        <div className="space-y-1">
          {[
            { label: 'Competitor tracking', desc: 'New pages, blog posts, pricing and backlink changes', value: trackCompetitors, set: setTrackCompetitors },
            { label: 'Keyword opportunities', desc: 'Gaps, featured snippets, PAA and trend detection', value: trackKeywords, set: setTrackKeywords },
            { label: 'Rank tracking', desc: 'Weekly position snapshots and movement alerts', value: trackRankings, set: setTrackRankings },
          ].map((feat) => (
            <div key={feat.label} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
              <div>
                <div className="text-sm font-medium text-slate-700">{feat.label}</div>
                <div className="text-xs text-slate-400">{feat.desc}</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={feat.value}
                aria-label={feat.label}
                onClick={() => feat.set(!feat.value)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${
                  feat.value ? 'bg-indigo-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    feat.value ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>

        {/* Rank alert threshold — only relevant when rank tracking is on */}
        {trackRankings && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Rank alert threshold
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={50}
                value={rankAlertThreshold}
                onChange={(e) => setRankAlertThreshold(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                className="w-20 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-xs text-slate-500">
                Alert me when a keyword moves at least this many places (up or down).
              </span>
            </div>
          </div>
        )}
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
                  onClick={() => setDataforseoEnabled(!dataforseoEnabled)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    dataforseoEnabled ? 'bg-indigo-600' : 'bg-slate-200'
                  }`}
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
    </div>
  )
}
