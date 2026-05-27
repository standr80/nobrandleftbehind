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

function normaliseUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return 'https://' + trimmed
}

function urlKey(raw: string): string {
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw
    const u = new URL(withScheme)
    return (u.hostname + u.pathname).replace(/\/$/, '').toLowerCase()
  } catch {
    return raw.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
  }
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default function CompetitorManager({
  clemReferenceUrls,
  scoutExtraUrls,
  latestSnapshots,
}: Props) {
  const [savedUrls, setSavedUrls] = useState<string[]>(scoutExtraUrls.filter(Boolean))
  const [newUrl, setNewUrl] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Per-URL crawl state
  const [crawling, setCrawling] = useState<Record<string, boolean>>({})
  const [crawlError, setCrawlError] = useState<Record<string, string | null>>({})

  // Local snapshot dates — updated after individual crawls
  const initialSnapshotByUrl = latestSnapshots.reduce<Record<string, string>>((acc, s) => {
    acc[urlKey(s.competitor_url)] = s.snapshot_date
    return acc
  }, {})
  const [snapshotDates, setSnapshotDates] = useState<Record<string, string>>(initialSnapshotByUrl)

  const router = useRouter()

  const remainingSlots = Math.max(0, 5 - clemReferenceUrls.length - savedUrls.length)
  const allMonitored = [...clemReferenceUrls, ...savedUrls].slice(0, 5)

  // ── Persist saved URLs to scout_config ──────────────────────────────────────
  async function persistUrls(urls: string[]) {
    const res = await fetch('/api/scout/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ competitor_urls: urls }),
    })
    if (!res.ok) {
      const d = await res.json()
      throw new Error(d.error ?? 'Failed to save')
    }
  }

  // ── Add a new URL ────────────────────────────────────────────────────────────
  async function handleAdd() {
    const url = normaliseUrl(newUrl)
    if (!url) { setAddError('Please enter a URL'); return }
    if (savedUrls.some((u) => urlKey(u) === urlKey(url))) {
      setAddError('Already in your list'); return
    }
    if (remainingSlots <= 0) { setAddError('No slots remaining'); return }

    setSaving(true)
    setAddError(null)
    try {
      const next = [...savedUrls, url]
      await persistUrls(next)
      setSavedUrls(next)
      setNewUrl('')
      router.refresh()
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // ── Remove a URL ─────────────────────────────────────────────────────────────
  async function handleRemove(url: string) {
    const next = savedUrls.filter((u) => u !== url)
    try {
      await persistUrls(next)
      setSavedUrls(next)
      router.refresh()
    } catch {
      // ignore — UI already updated optimistically
    }
  }

  // ── Crawl a single URL ───────────────────────────────────────────────────────
  async function handleCrawl(url: string) {
    setCrawling((prev) => ({ ...prev, [url]: true }))
    setCrawlError((prev) => ({ ...prev, [url]: null }))
    try {
      const res = await fetch('/api/scout/crawl-competitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCrawlError((prev) => ({ ...prev, [url]: data.error ?? 'Crawl failed' }))
      } else {
        setSnapshotDates((prev) => ({ ...prev, [urlKey(url)]: data.snapshot_date }))
      }
    } catch {
      setCrawlError((prev) => ({ ...prev, [url]: 'Network error' }))
    } finally {
      setCrawling((prev) => ({ ...prev, [url]: false }))
    }
  }

  return (
    <div className="space-y-6">
      {/* From Clem settings (read-only) */}
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
              const date = snapshotDates[urlKey(url)]
              const isCrawling = crawling[url] ?? false
              const err = crawlError[url]
              return (
                <div
                  key={url}
                  className="flex items-center gap-3 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                >
                  <span className="text-xs px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded font-medium shrink-0">
                    Clem
                  </span>
                  <span className="text-sm text-slate-600 truncate flex-1">{url}</span>
                  {err && <span className="text-xs text-red-500 shrink-0">{err}</span>}
                  <span className="text-xs text-slate-400 shrink-0">
                    {date ? `Last crawled ${fmtDate(date)}` : 'Not yet crawled'}
                  </span>
                  <button
                    onClick={() => handleCrawl(url)}
                    disabled={isCrawling}
                    className="text-xs px-2.5 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors shrink-0"
                  >
                    {isCrawling ? 'Crawling…' : date ? 'Re-crawl' : 'Crawl'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Scout-only additions */}
      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-1">Scout-only additions</h2>
        <p className="text-xs text-slate-400 mb-4">
          {remainingSlots > 0
            ? `${5 - clemReferenceUrls.length - savedUrls.length} of ${5 - clemReferenceUrls.length} slot${5 - clemReferenceUrls.length !== 1 ? 's' : ''} remaining.`
            : 'All slots are filled.'}
        </p>

        {/* Saved Scout-only URLs */}
        {savedUrls.length > 0 && (
          <div className="space-y-2 mb-4">
            {savedUrls.map((url) => {
              const key = urlKey(url)
              const date = snapshotDates[key]
              const isCrawling = crawling[url] ?? false
              const err = crawlError[url]
              return (
                <div key={url} className="flex items-center gap-3 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-sm text-slate-700 truncate flex-1">{url}</span>
                  <span className="text-xs text-slate-400 shrink-0">
                    {date ? `Last crawled ${fmtDate(date)}` : 'Not yet crawled'}
                  </span>
                  {err && <span className="text-xs text-red-500 shrink-0">{err}</span>}
                  <button
                    onClick={() => handleCrawl(url)}
                    disabled={isCrawling}
                    className="text-xs px-2.5 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors shrink-0"
                  >
                    {isCrawling ? 'Crawling…' : date ? 'Re-crawl' : 'Crawl'}
                  </button>
                  <button
                    onClick={() => handleRemove(url)}
                    disabled={isCrawling}
                    className="text-slate-400 hover:text-red-500 transition-colors shrink-0 disabled:opacity-50"
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Add new URL */}
        {remainingSlots > 0 && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={newUrl}
                onChange={(e) => { setNewUrl(e.target.value); setAddError(null) }}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="https://www.competitor.com"
                className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleAdd}
                disabled={saving || !newUrl.trim()}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : 'Add'}
              </button>
            </div>
            {addError && <p className="text-xs text-red-500">{addError}</p>}
          </div>
        )}
      </div>

      {/* Summary */}
      {allMonitored.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3">
          <p className="text-xs text-indigo-700 font-medium">
            Scout monitors {allMonitored.length} competitor{allMonitored.length !== 1 ? 's' : ''} in total
            {clemReferenceUrls.length > 0 && savedUrls.length > 0
              ? ` (${clemReferenceUrls.length} from Clem settings, ${savedUrls.length} Scout-only)`
              : ''}
            .
          </p>
        </div>
      )}

      {/* Latest snapshots detail */}
      {latestSnapshots.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Latest snapshot details</h2>
          <div className="space-y-4">
            {latestSnapshots.map((snapshot) => {
              const newPosts = Array.isArray(snapshot.new_blog_posts) ? snapshot.new_blog_posts : []
              const isFromClem = clemReferenceUrls.some((u) => urlKey(u) === urlKey(snapshot.competitor_url))
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
                        Last crawled: {fmtDate(snapshot.snapshot_date)}
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
                              <a href={post.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
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
