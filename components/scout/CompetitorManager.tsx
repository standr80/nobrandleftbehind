'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Snapshot {
  id: string
  competitor_url: string
  snapshot_date: string
  page_count: number | null
  new_blog_posts: unknown
  pricing_changed: boolean | null
  pricing_change_summary: string | null
  created_at: string | null
}

interface Props {
  clemReferenceUrls: string[]
  scoutExtraUrls: string[]
  latestSnapshots: Snapshot[]
}

export default function CompetitorManager({
  clemReferenceUrls,
  scoutExtraUrls,
  latestSnapshots,
}: Props) {
  // Scout-specific extras only — Clem reference URLs are managed in Settings
  const [extraUrls, setExtraUrls] = useState<string[]>(
    scoutExtraUrls.length ? scoutExtraUrls : [''],
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Index snapshots by URL for quick lookup
  const snapshotByUrl = latestSnapshots.reduce<Record<string, Snapshot>>((acc, s) => {
    acc[s.competitor_url] = s
    return acc
  }, {})

  // Combined list (Clem first, then Scout extras), capped at 5
  const allMonitored = [
    ...clemReferenceUrls,
    ...scoutExtraUrls.filter((u) => u && !clemReferenceUrls.includes(u)),
  ].slice(0, 5)

  const remainingSlots = 5 - clemReferenceUrls.length

  function addUrl() {
    if (extraUrls.filter(Boolean).length < remainingSlots) setExtraUrls([...extraUrls, ''])
  }

  function removeUrl(index: number) {
    setExtraUrls(extraUrls.filter((_, i) => i !== index))
  }

  function updateUrl(index: number, value: string) {
    const next = [...extraUrls]
    next[index] = value
    setExtraUrls(next)
  }

  function normaliseUrl(raw: string): string {
    const trimmed = raw.trim()
    if (!trimmed) return ''
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    return 'https://' + trimmed
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError(null)
    const validUrls = extraUrls.map(normaliseUrl).filter((u) => u.length > 0)
    try {
      const res = await fetch('/api/scout/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitor_urls: validUrls }),
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
    <div className="space-y-6">
      {/* Clem reference URLs (read-only here) */}
      {clemReferenceUrls.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700">From Clem settings</h2>
            <Link
              href="/settings"
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Edit in Settings →
            </Link>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            These reference URLs are set in your Clem AI settings and are automatically monitored by Scout.
          </p>
          <div className="space-y-2">
            {clemReferenceUrls.map((url) => {
              const snap = snapshotByUrl[url]
              return (
                <div
                  key={url}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                >
                  <span className="text-xs px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded font-medium shrink-0">
                    Clem
                  </span>
                  <span className="text-sm text-slate-600 truncate flex-1">{url}</span>
                  <span className="text-xs text-slate-400 shrink-0">
                    {snap
                      ? `Last crawled ${new Date(snap.snapshot_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                      : 'Not yet crawled'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Scout-specific additions */}
      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-1">Scout-only additions</h2>
        <p className="text-xs text-slate-400 mb-4">
          {remainingSlots > 0
            ? `Add up to ${remainingSlots} more competitor URL${remainingSlots !== 1 ? 's' : ''} to monitor (${5 - clemReferenceUrls.length - scoutExtraUrls.filter(Boolean).length} slot${5 - clemReferenceUrls.length - scoutExtraUrls.filter(Boolean).length !== 1 ? 's' : ''} remaining).`
            : 'All 5 competitor slots are filled by your Clem reference URLs.'}
        </p>

        {remainingSlots > 0 && (
          <>
            <div className="space-y-3">
              {extraUrls.map((url, i) => {
                const snap = url ? snapshotByUrl[url] ?? snapshotByUrl[url.replace(/\/$/, '')] : null
                return (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={url}
                      onChange={(e) => updateUrl(i, e.target.value)}
                      placeholder="https://www.competitor.com"
                      className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {url && (
                      <span className="text-xs text-slate-400 shrink-0 w-32 text-right">
                        {snap
                          ? new Date(snap.snapshot_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                          : 'Not yet crawled'}
                      </span>
                    )}
                    <button
                      onClick={() => removeUrl(i)}
                      className="px-2 py-2 text-slate-400 hover:text-red-500 transition-colors"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                )
              })}
            </div>
            {extraUrls.filter(Boolean).length < remainingSlots && (
              <button
                onClick={addUrl}
                className="mt-3 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
              >
                + Add another
              </button>
            )}
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              {saved && <span className="text-sm text-green-600">✓ Saved</span>}
              {error && <span className="text-sm text-red-500">{error}</span>}
            </div>
          </>
        )}
      </div>

      {/* Summary of all monitored URLs */}
      {allMonitored.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3">
          <p className="text-xs text-indigo-700 font-medium">
            Scout monitors {allMonitored.length} competitor{allMonitored.length !== 1 ? 's' : ''} in total
            {clemReferenceUrls.length > 0 && scoutExtraUrls.filter(Boolean).length > 0
              ? ` (${clemReferenceUrls.length} from Clem settings, ${scoutExtraUrls.filter(Boolean).length} Scout-only)`
              : ''}
            .
          </p>
        </div>
      )}

      {/* Latest snapshots */}
      {latestSnapshots.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Latest snapshots</h2>
          <div className="space-y-4">
            {latestSnapshots.map((snapshot) => {
              const newPosts = Array.isArray(snapshot.new_blog_posts) ? snapshot.new_blog_posts : []
              const isFromClem = clemReferenceUrls.includes(snapshot.competitor_url)
              return (
                <div key={snapshot.id} className="border border-slate-100 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        {isFromClem && (
                          <span className="text-xs px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded font-medium shrink-0">
                            Clem
                          </span>
                        )}
                        <a
                          href={snapshot.competitor_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-indigo-600 hover:text-indigo-800 break-all"
                        >
                          {snapshot.competitor_url}
                        </a>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        Last crawled:{' '}
                        {new Date(snapshot.snapshot_date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                        {snapshot.page_count != null && ` · ${snapshot.page_count} pages`}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {snapshot.pricing_changed && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-medium">
                          Pricing changed
                        </span>
                      )}
                      {newPosts.length > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
                          {newPosts.length} new post{newPosts.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {snapshot.pricing_change_summary && (
                    <div className="mt-2 text-xs text-red-700 bg-red-50 rounded p-2">
                      {snapshot.pricing_change_summary}
                    </div>
                  )}

                  {newPosts.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs text-slate-500 font-medium mb-1">New content:</div>
                      <ul className="space-y-1">
                        {(newPosts as { title?: string; url?: string }[]).slice(0, 5).map((post, i) => (
                          <li key={i} className="text-xs text-slate-600">
                            {post.url ? (
                              <a
                                href={post.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-600 hover:underline"
                              >
                                {post.title ?? post.url}
                              </a>
                            ) : (
                              post.title ?? '—'
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {allMonitored.length === 0 && (
        <div className="bg-slate-50 rounded-lg border border-dashed border-slate-300 p-8 text-center">
          <p className="text-sm text-slate-500">
            No competitors monitored yet.{' '}
            <Link href="/settings" className="text-indigo-600 hover:text-indigo-800">
              Add reference URLs in Clem settings
            </Link>{' '}
            or add Scout-only URLs above.
          </p>
        </div>
      )}
    </div>
  )
}
