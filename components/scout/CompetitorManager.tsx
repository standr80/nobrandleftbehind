'use client'

/**
 * Competitor monitoring view. The list of monitored sites is managed in one
 * place — Settings → Sites (sites flagged as Competitor). This component
 * shows crawl status / snapshots and lets the user trigger immediate crawls.
 */

import { useState } from 'react'
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
  tenantId: string
  competitorUrls: string[]
  latestSnapshots: Snapshot[]
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

export default function CompetitorManager({ tenantId, competitorUrls, latestSnapshots }: Props) {
  // Per-URL crawl state
  const [crawling, setCrawling] = useState<Record<string, boolean>>({})
  const [crawlError, setCrawlError] = useState<Record<string, string | null>>({})

  // Local snapshot dates — updated after individual crawls
  const initialSnapshotByUrl = latestSnapshots.reduce<Record<string, string>>((acc, s) => {
    acc[urlKey(s.competitor_url)] = s.snapshot_date
    return acc
  }, {})
  const [snapshotDates, setSnapshotDates] = useState<Record<string, string>>(initialSnapshotByUrl)

  async function handleCrawl(url: string) {
    setCrawling((prev) => ({ ...prev, [url]: true }))
    setCrawlError((prev) => ({ ...prev, [url]: null }))
    try {
      const res = await fetch('/api/scout/crawl-competitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, url }),
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
      {/* Monitored competitor sites */}
      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700">Monitored competitors</h2>
          <Link
            href="/settings"
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Manage in Settings → Sites
          </Link>
        </div>
        {competitorUrls.length > 0 ? (
          <div className="space-y-2">
            {competitorUrls.map((url) => {
              const date = snapshotDates[urlKey(url)]
              const isCrawling = crawling[url] ?? false
              const err = crawlError[url]
              return (
                <div
                  key={url}
                  className="flex items-center gap-3 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                >
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
        ) : (
          <div className="bg-slate-50 rounded-lg border border-dashed border-slate-300 p-8 text-center">
            <p className="text-sm text-slate-500">
              No competitors monitored yet.{' '}
              <Link href="/settings" className="text-indigo-600 hover:text-indigo-800">
                Add competitor sites in Settings → Sites
              </Link>
              .
            </p>
          </div>
        )}
      </div>

      {/* Latest snapshots detail */}
      {latestSnapshots.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Latest snapshot details</h2>
          <div className="space-y-4">
            {latestSnapshots.map((snapshot) => {
              const newPosts = Array.isArray(snapshot.new_blog_posts) ? snapshot.new_blog_posts : []
              return (
                <div key={snapshot.id} className="border border-slate-100 rounded-lg p-4">
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
    </div>
  )
}
