'use client'

/**
 * Unified competitor / reference site manager — the single place sites are
 * entered. Scout monitors competitor-flagged sites; Clem draws content
 * inspiration from reference-flagged sites. Per-workspace slot limits are
 * superadmin-set and enforced server-side.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export interface SiteRow {
  id: string
  url: string
  is_competitor: boolean
  is_reference: boolean
  label: string | null
}

export interface SiteLimitsView {
  maxCompetitorSites: number
  maxReferenceSites: number
}

export interface ReferenceCrawlInfo {
  url: string
  crawled_at: string | null
}

interface Props {
  tenantId: string
  isAdmin: boolean
  initialSites: SiteRow[]
  limits: SiteLimitsView
  referenceCrawls: ReferenceCrawlInfo[]
}

function fmtDate(iso: string | null): string {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function SitesManager({ tenantId, isAdmin, initialSites, limits, referenceCrawls }: Props) {
  const router = useRouter()
  const [sites, setSites] = useState<SiteRow[]>(initialSites)
  const [newUrl, setNewUrl] = useState('')
  const [newCompetitor, setNewCompetitor] = useState(true)
  const [newReference, setNewReference] = useState(false)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [crawling, setCrawling] = useState<Record<string, boolean>>({})
  const [crawlMsgs, setCrawlMsgs] = useState<Record<string, string>>({})
  const [crawledAt, setCrawledAt] = useState<Record<string, string | null>>(
    referenceCrawls.reduce<Record<string, string | null>>((acc, r) => {
      acc[r.url.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')] = r.crawled_at
      return acc
    }, {}),
  )

  const competitorCount = sites.filter((s) => s.is_competitor).length
  const referenceCount = sites.filter((s) => s.is_reference).length

  async function addSite() {
    const url = newUrl.trim()
    if (!url) return
    setAdding(true)
    setError('')
    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, url, is_competitor: newCompetitor, is_reference: newReference }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to add site')
      setSites((prev) => [...prev, data.site])
      setNewUrl('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add site')
    } finally {
      setAdding(false)
    }
  }

  async function toggleRole(site: SiteRow, role: 'is_competitor' | 'is_reference') {
    setBusyId(site.id)
    setError('')
    try {
      const res = await fetch(`/api/sites/${site.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, [role]: !site[role] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to update site')
      setSites((prev) => prev.map((s) => (s.id === site.id ? data.site : s)))
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update site')
    } finally {
      setBusyId(null)
    }
  }

  async function removeSite(site: SiteRow) {
    if (!confirm(`Remove ${site.url}?`)) return
    setBusyId(site.id)
    setError('')
    try {
      const res = await fetch(`/api/sites/${site.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to remove site')
      setSites((prev) => prev.filter((s) => s.id !== site.id))
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove site')
    } finally {
      setBusyId(null)
    }
  }

  async function crawlReference(site: SiteRow) {
    setCrawling((prev) => ({ ...prev, [site.id]: true }))
    setCrawlMsgs((prev) => ({ ...prev, [site.id]: '' }))
    try {
      const res = await fetch('/api/clem/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, url: site.url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Crawl failed')
      setCrawledAt((prev) => ({ ...prev, [site.url]: new Date().toISOString() }))
      setCrawlMsgs((prev) => ({ ...prev, [site.id]: '✓ Crawled' }))
    } catch (err) {
      setCrawlMsgs((prev) => ({ ...prev, [site.id]: err instanceof Error ? err.message : 'Crawl failed' }))
    } finally {
      setCrawling((prev) => ({ ...prev, [site.id]: false }))
    }
  }

  const chipBase = 'text-xs px-2.5 py-1 rounded-full border transition-colors disabled:opacity-40'

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium mb-1">Competitor &amp; reference sites</p>
        <p className="text-xs text-slate-400">
          One list, two roles. <strong>Competitor</strong> sites are monitored by Scout (rankings,
          new pages, pricing). <strong>Reference</strong> sites are crawled by Clem for topic ideas
          and content inspiration — they don&apos;t need to be rivals. A site can be both.
        </p>
      </div>

      {/* Slot usage */}
      <div className="flex flex-wrap gap-3">
        <span className="text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-600">
          Competitor slots: <strong>{competitorCount} of {limits.maxCompetitorSites}</strong> used
        </span>
        <span className="text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-600">
          Reference slots: <strong>{referenceCount} of {limits.maxReferenceSites}</strong> used
        </span>
      </div>

      {/* Site list */}
      <div className="space-y-3">
        {sites.map((site) => {
          const lastCrawl = crawledAt[site.url] ?? null
          const msg = crawlMsgs[site.id] ?? ''
          return (
            <div key={site.id} className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-800 font-mono truncate">{site.url}</p>
                {site.is_reference && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    Last crawled by Clem: <span className="text-slate-600">{fmtDate(lastCrawl)}</span>
                  </p>
                )}
                {msg && (
                  <p className={`text-xs mt-1 ${msg.startsWith('✓') ? 'text-emerald-700' : 'text-red-600'}`}>{msg}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                <button
                  type="button"
                  disabled={!isAdmin || busyId === site.id}
                  onClick={() => toggleRole(site, 'is_competitor')}
                  className={`${chipBase} ${
                    site.is_competitor
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-white border-slate-200 text-slate-400 hover:text-slate-700'
                  }`}
                  title="Scout monitors this site"
                >
                  Competitor
                </button>
                <button
                  type="button"
                  disabled={!isAdmin || busyId === site.id}
                  onClick={() => toggleRole(site, 'is_reference')}
                  className={`${chipBase} ${
                    site.is_reference
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'bg-white border-slate-200 text-slate-400 hover:text-slate-700'
                  }`}
                  title="Clem draws content inspiration from this site"
                >
                  Reference
                </button>
                {site.is_reference && (
                  <button
                    type="button"
                    onClick={() => crawlReference(site)}
                    disabled={crawling[site.id] ?? false}
                    className="text-xs px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-slate-700 rounded-lg transition-colors"
                  >
                    {crawling[site.id] ? 'Crawling…' : '↺ Crawl'}
                  </button>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => removeSite(site)}
                    disabled={busyId === site.id}
                    className="px-2 py-1 text-xs text-slate-300 hover:text-red-500 transition-colors rounded-lg"
                    title="Remove"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          )
        })}
        {sites.length === 0 && (
          <p className="text-xs text-slate-400 bg-slate-50 border border-dashed border-slate-300 rounded-xl px-4 py-6 text-center">
            No sites yet. Add a competitor to monitor or a reference site for content ideas.
          </p>
        )}
      </div>

      {/* Add site */}
      {isAdmin && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              className="flex-1 bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
              value={newUrl}
              onChange={(e) => { setNewUrl(e.target.value); setError('') }}
              onKeyDown={(e) => e.key === 'Enter' && addSite()}
              placeholder="competitor.com or industry-blog.com"
            />
            <button
              type="button"
              onClick={addSite}
              disabled={adding || !newUrl.trim() || (!newCompetitor && !newReference)}
              className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg transition-colors shrink-0"
            >
              {adding ? 'Adding…' : '+ Add'}
            </button>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
              <input type="checkbox" checked={newCompetitor} onChange={(e) => setNewCompetitor(e.target.checked)} />
              Competitor
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
              <input type="checkbox" checked={newReference} onChange={(e) => setNewReference(e.target.checked)} />
              Reference
            </label>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}

      <p className="text-xs text-slate-400">
        Competitor monitoring results appear in{' '}
        <Link href="/dashboard/scout/competitors" className="text-indigo-600 hover:underline">
          Scout → Competitors
        </Link>
        . Reference crawls feed Clem&apos;s blog suggestions and are billed against your Firecrawl
        quota — only crawl when needed.
      </p>
    </div>
  )
}
