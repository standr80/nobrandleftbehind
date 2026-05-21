'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
  initialUrls: string[]
  latestSnapshots: Snapshot[]
  isAdmin: boolean
}

export default function CompetitorManager({ initialUrls, latestSnapshots, isAdmin }: Props) {
  const [urls, setUrls] = useState<string[]>(initialUrls.length ? initialUrls : [''])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const snapshotMap = Object.fromEntries(latestSnapshots.map((s) => [s.competitor_url, s]))

  function addUrl() {
    if (urls.length < 5) setUrls([...urls, ''])
  }

  function removeUrl(index: number) {
    setUrls(urls.filter((_, i) => i !== index))
  }

  function updateUrl(index: number, value: string) {
    const next = [...urls]
    next[index] = value
    setUrls(next)
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError(null)
    const validUrls = urls.map((u) => u.trim()).filter((u) => u.length > 0)
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
      {/* URL management */}
      {isAdmin && (
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Competitor URLs (max 5)</h2>
          <div className="space-y-3">
            {urls.map((url, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => updateUrl(i, e.target.value)}
                  placeholder="https://www.competitor.com"
                  className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={() => removeUrl(i)}
                  className="px-2 py-2 text-slate-400 hover:text-red-500 transition-colors"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          {urls.length < 5 && (
            <button
              onClick={addUrl}
              className="mt-3 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              + Add another competitor
            </button>
          )}
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save competitors'}
            </button>
            {saved && <span className="text-sm text-green-600">✓ Saved</span>}
            {error && <span className="text-sm text-red-500">{error}</span>}
          </div>
        </div>
      )}

      {/* Latest snapshots */}
      {latestSnapshots.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Latest snapshots</h2>
          <div className="space-y-4">
            {latestSnapshots.map((snapshot) => {
              const newPosts = Array.isArray(snapshot.new_blog_posts)
                ? snapshot.new_blog_posts
                : []
              return (
                <div
                  key={snapshot.id}
                  className="border border-slate-100 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <a
                        href={snapshot.competitor_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-800 break-all"
                      >
                        {snapshot.competitor_url}
                      </a>
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

      {!initialUrls.length && latestSnapshots.length === 0 && (
        <div className="bg-slate-50 rounded-lg border border-dashed border-slate-300 p-8 text-center">
          <p className="text-sm text-slate-500">
            No competitors monitored yet. Add URLs above and run Scout to start tracking.
          </p>
        </div>
      )}
    </div>
  )
}
