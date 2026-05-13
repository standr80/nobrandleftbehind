'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { ReferenceSummary } from '@/lib/clem/suggest'
import type { BlogTheme, BlogNavLink } from '@/lib/blog/types'

const CADENCE_OPTIONS = ['1pw', '2pw', '3pw', '5pw', 'daily']
const DAYS_OPTIONS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const CMS_OPTIONS = [
  { value: 'git', label: 'Git (GitHub PR)', description: 'Clem opens a PR on your repo' },
  { value: 'ghost', label: 'Ghost', description: 'Publish via Ghost Admin API' },
  { value: 'wordpress', label: 'WordPress', description: 'Publish via WordPress REST API' },
  { value: 'webhook', label: 'Custom webhook', description: 'POST to your own endpoint' },
  { value: 'download', label: 'Manual / Download', description: 'Export MDX files manually' },
]

interface Tenant {
  id: string
  name: string
  domain: string
  logo_url: string | null
  brand_voice: string | null
  target_audience: string | null
  forbidden_words: string[] | null
  cms_type: string | null
  git_repo: string | null
  git_branch: string | null
  git_blog_path: string | null
  publish_cadence: string | null
  publish_days: string[] | null
  publish_time: string | null
  post_cadence_active: boolean | null
  billing_tier: string | null
  reference_urls: string[] | null
  white_label_domain: string | null
  blog_theme: BlogTheme | null
  theme_extract_url: string | null
}

interface Member {
  id: string
  name: string | null
  email: string | null
  role: string
  clerk_user_id: string
  created_at: string | null
}

interface Props {
  tenant: Tenant
  members: Member[]
  isAdmin: boolean
  crawledAt: string | null
  referenceSummaries: ReferenceSummary[]
}

type Section = 'basics' | 'clem' | 'brand' | 'publishing' | 'team' | 'embed'

function domainToSlug(domain: string): string {
  return domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('.')[0].toLowerCase()
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function SettingsForm({
  tenant,
  members: initialMembers,
  isAdmin,
  crawledAt: initialCrawledAt,
  referenceSummaries: initialReferenceSummaries,
}: Props) {
  const router = useRouter()
  const [section, setSection] = useState<Section>('basics')

  // ── Crawl state ──────────────────────────────────────────────
  const [crawling, setCrawling] = useState(false)
  const [crawlMsg, setCrawlMsg] = useState('')
  const [crawledAt, setCrawledAt] = useState<string | null>(initialCrawledAt)

  // ── Reference URLs state ─────────────────────────────────────
  const [referenceUrls, setReferenceUrls] = useState<string[]>(
    tenant.reference_urls?.filter(Boolean) ?? []
  )
  const [newRefUrl, setNewRefUrl] = useState('')
  const [savingRefUrls, setSavingRefUrls] = useState(false)
  const [refUrlMsg, setRefUrlMsg] = useState('')
  // key = URL string, value = loading / success msg
  const [refCrawling, setRefCrawling] = useState<Record<string, boolean>>({})
  const [refCrawlMsgs, setRefCrawlMsgs] = useState<Record<string, string>>({})
  const [referenceSummaries, setReferenceSummaries] = useState<ReferenceSummary[]>(
    initialReferenceSummaries
  )

  // ── Blog domain + theme state ─────────────────────────────────
  const [blogDomain, setBlogDomain] = useState(tenant.white_label_domain ?? '')
  const [blogTheme, setBlogTheme] = useState<BlogTheme | null>(tenant.blog_theme)
  const [extracting, setExtracting] = useState(false)
  const [extractMsg, setExtractMsg] = useState('')
  const [extractUrl, setExtractUrl] = useState(tenant.theme_extract_url ?? '')
  const [savingExtractUrl, setSavingExtractUrl] = useState(false)
  // Editable nav links (all users)
  const [navLinks, setNavLinks] = useState<BlogNavLink[]>(
    tenant.blog_theme?.navLinks ?? []
  )
  const [newNavLabel, setNewNavLabel] = useState('')
  const [newNavUrl, setNewNavUrl] = useState('')
  const [savingNav, setSavingNav] = useState(false)
  const [navMsg, setNavMsg] = useState('')

  // ── Suggest state ────────────────────────────────────────────
  const [suggesting, setSuggesting] = useState(false)
  const [suggestMsg, setSuggestMsg] = useState('')

  // ── Team state ───────────────────────────────────────────────
  const [memberList, setMemberList] = useState<Member[]>(initialMembers)
  const [showAddMember, setShowAddMember] = useState(false)
  const [addEmail, setAddEmail] = useState('')
  const [addRole, setAddRole] = useState<'author' | 'reviewer' | 'admin'>('author')
  const [addingMember, setAddingMember] = useState(false)
  const [addMemberError, setAddMemberError] = useState('')
  const [inviteResult, setInviteResult] = useState<{ emailSent: boolean; inviteUrl: string } | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  // ── General form state ───────────────────────────────────────
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // ── Embed builder state ──────────────────────────────────────
  const [embedMode, setEmbedMode] = useState('feed')
  const [embedTheme, setEmbedTheme] = useState('light')
  const [embedAccent, setEmbedAccent] = useState('#2563eb')
  const [embedLimit, setEmbedLimit] = useState('6')
  const [embedShowImages, setEmbedShowImages] = useState(true)
  const [embedShowAuthor, setEmbedShowAuthor] = useState(true)
  const [embedOpen, setEmbedOpen] = useState('modal')
  const [embedCopied, setEmbedCopied] = useState(false)

  // ── Basics form fields ───────────────────────────────────────
  const [name, setName] = useState(tenant.name)
  const [domain, setDomain] = useState(tenant.domain)
  const [logoUrl, setLogoUrl] = useState(tenant.logo_url ?? '')
  const [brandVoice, setBrandVoice] = useState(tenant.brand_voice ?? '')
  const [targetAudience, setTargetAudience] = useState(tenant.target_audience ?? '')
  const [forbiddenWords, setForbiddenWords] = useState((tenant.forbidden_words ?? []).join(', '))
  const [cmsType, setCmsType] = useState(tenant.cms_type ?? 'download')
  const [gitRepo, setGitRepo] = useState(tenant.git_repo ?? '')
  const [gitBranch, setGitBranch] = useState(tenant.git_branch ?? 'main')
  const [gitBlogPath, setGitBlogPath] = useState(tenant.git_blog_path ?? 'content/blog')
  const [cadence, setCadence] = useState(tenant.publish_cadence ?? '2pw')
  const [days, setDays] = useState<string[]>(tenant.publish_days ?? ['tuesday', 'thursday'])
  const [time, setTime] = useState(tenant.publish_time ?? '09:00')
  const [cadenceActive, setCadenceActive] = useState(tenant.post_cadence_active ?? true)

  function toggleDay(day: string) {
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    )
  }

  // ── Save basic settings ───────────────────────────────────────
  async function save() {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch('/api/tenant', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          domain: domain.replace(/^https?:\/\//, '').replace(/\/$/, ''),
          logo_url: logoUrl || null,
          brand_voice: brandVoice || null,
          target_audience: targetAudience || null,
          forbidden_words: forbiddenWords
            ? forbiddenWords.split(',').map((w) => w.trim()).filter(Boolean)
            : [],
          cms_type: cmsType,
          git_repo: gitRepo || null,
          git_branch: gitBranch || 'main',
          git_blog_path: gitBlogPath || 'content/blog',
          publish_cadence: cadence,
          publish_days: days,
          publish_time: time,
          post_cadence_active: cadenceActive,
          white_label_domain: blogDomain.replace(/^https?:\/\//, '').replace(/\/$/, '').trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      setSaved(true)
      router.refresh()
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  // ── Main site re-crawl ────────────────────────────────────────
  async function recrawl() {
    setCrawling(true)
    setCrawlMsg('')
    try {
      const res = await fetch('/api/clem/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: tenant.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Crawl failed')
      const now = new Date().toISOString()
      setCrawledAt(now)
      setCrawlMsg('✓ Site crawled successfully')
    } catch (err) {
      setCrawlMsg(err instanceof Error ? err.message : 'Crawl failed')
    } finally {
      setCrawling(false)
    }
  }

  // ── Reference URL management ──────────────────────────────────
  function addReferenceUrl() {
    const trimmed = newRefUrl.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '')
    if (!trimmed || referenceUrls.includes(trimmed) || referenceUrls.length >= 3) return
    setReferenceUrls((prev) => [...prev, trimmed])
    setNewRefUrl('')
  }

  function removeReferenceUrl(url: string) {
    setReferenceUrls((prev) => prev.filter((u) => u !== url))
    setReferenceSummaries((prev) => prev.filter((r) => r.url !== url))
    setRefCrawlMsgs((prev) => { const next = { ...prev }; delete next[url]; return next })
  }

  async function saveReferenceUrls() {
    setSavingRefUrls(true)
    setRefUrlMsg('')
    try {
      const res = await fetch('/api/tenant', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference_urls: referenceUrls }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      setRefUrlMsg('✓ Reference URLs saved')
      router.refresh()
      setTimeout(() => setRefUrlMsg(''), 2500)
    } catch (err) {
      setRefUrlMsg(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSavingRefUrls(false)
    }
  }

  async function crawlReferenceUrl(url: string) {
    setRefCrawling((prev) => ({ ...prev, [url]: true }))
    setRefCrawlMsgs((prev) => ({ ...prev, [url]: '' }))
    try {
      const res = await fetch('/api/clem/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: tenant.id, url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Crawl failed')
      const now = new Date().toISOString()
      setReferenceSummaries((prev) => [
        ...prev.filter((r) => r.url !== url),
        { url, summary: '', crawled_at: now },
      ])
      setRefCrawlMsgs((prev) => ({ ...prev, [url]: '✓ Crawled' }))
    } catch (err) {
      setRefCrawlMsgs((prev) => ({
        ...prev,
        [url]: err instanceof Error ? err.message : 'Crawl failed',
      }))
    } finally {
      setRefCrawling((prev) => ({ ...prev, [url]: false }))
    }
  }

  // ── Generate suggestions ──────────────────────────────────────
  async function generateSuggestions() {
    setSuggesting(true)
    setSuggestMsg('')
    try {
      const res = await fetch('/api/clem/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: tenant.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Suggestion generation failed')
      setSuggestMsg('✓ New suggestions generated — check the Ideas tab')
    } catch (err) {
      setSuggestMsg(err instanceof Error ? err.message : 'Failed to generate suggestions')
    } finally {
      setSuggesting(false)
    }
  }

  // ── Team management ───────────────────────────────────────────
  async function sendInvite() {
    if (!addEmail.trim()) return
    setAddingMember(true)
    setAddMemberError('')
    setInviteResult(null)
    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: addEmail.trim(), role: addRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to send invite')
      setInviteResult({ emailSent: data.emailSent, inviteUrl: data.inviteUrl })
      setAddEmail('')
      setAddRole('author')
    } catch (err) {
      setAddMemberError(err instanceof Error ? err.message : 'Failed to send invite')
    } finally {
      setAddingMember(false)
    }
  }

  async function removeMember(memberId: string) {
    if (!confirm('Remove this member from the workspace?')) return
    setRemovingId(memberId)
    try {
      const res = await fetch('/api/tenant/members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to remove')
      setMemberList((prev) => prev.filter((m) => m.id !== memberId))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove member')
    } finally {
      setRemovingId(null)
    }
  }

  // ── Embed snippet ─────────────────────────────────────────────
  const tenantSlug = domainToSlug(tenant.domain)

  const embedSnippet = useCallback(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `<script\n  src="${origin}/embed.js"\n  data-tenant="${tenantSlug}"\n  data-theme="${embedTheme}"\n  data-accent="${embedAccent}"\n  data-mode="${embedMode}"\n  data-limit="${embedLimit}"\n  data-open="${embedOpen}"\n  data-show-images="${embedShowImages}"\n  data-show-author="${embedShowAuthor}">\n</script>`
  }, [tenantSlug, embedTheme, embedAccent, embedMode, embedLimit, embedOpen, embedShowImages, embedShowAuthor])

  function copyEmbed() {
    navigator.clipboard.writeText(embedSnippet()).then(() => {
      setEmbedCopied(true)
      setTimeout(() => setEmbedCopied(false), 2000)
    })
  }

  // ─────────────────────────────────────────────────────────────
  const inputClass =
    'w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors'
  const labelClass = 'block text-xs text-slate-500 mb-1.5'

  const sections: { id: Section; label: string }[] = [
    { id: 'basics', label: 'Basics' },
    { id: 'clem', label: 'Clem AI' },
    { id: 'brand', label: 'Brand' },
    { id: 'publishing', label: 'Publishing' },
    { id: 'team', label: 'Team' },
    { id: 'embed', label: 'Embed' },
  ]

  return (
    <div className="space-y-1">
      {/* Section nav */}
      <div className="flex flex-wrap gap-1 mb-6">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              section === s.id
                ? 'bg-indigo-50 text-indigo-600 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-900'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-8 space-y-5">

        {/* ── Basics ── */}
        {section === 'basics' && (
          <>
            <div>
              <label className={labelClass}>Name</label>
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Domain</label>
              <input className={inputClass} value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="designsonprint.com" />
            </div>
            <div>
              <label className={labelClass}>Logo URL (optional)</label>
              <input className={inputClass} value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <label className={labelClass}>Blog subdomain</label>
              <input
                className={inputClass}
                value={blogDomain}
                onChange={(e) => setBlogDomain(e.target.value)}
                placeholder="blog.designsonprint.com"
              />
              <p className="text-xs text-slate-400 mt-1">
                The subdomain where your Clem-hosted blog lives (e.g. <span className="font-mono text-slate-300">blog.designsonprint.com</span>).
                First add the subdomain in Vercel → your project → Settings → Domains — Vercel will
                show you a unique CNAME target (e.g. <span className="font-mono text-slate-300">be549e9ea49c997c.vercel-dns-016.com</span>).
                Add that as a CNAME record in your DNS, then enter the subdomain here.
              </p>
              {blogDomain && (
                <a
                  href={`https://${blogDomain.replace(/^https?:\/\//, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
                >
                  View blog →
                </a>
              )}
            </div>
            <div>
              <label className={labelClass}>Billing tier</label>
              <p className="text-sm text-slate-600 bg-white border border-slate-200 rounded-lg px-4 py-2.5 capitalize">
                {tenant.billing_tier ?? 'starter'}
              </p>
            </div>
          </>
        )}

        {/* ── Clem AI ── */}
        {section === 'clem' && (
          <div className="space-y-6">

            {/* Main site crawl */}
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Your site crawl</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Re-crawl your domain so Clem understands your current content and writing style.
                    Always re-crawl after making significant changes to your site.
                  </p>
                  <p className="text-xs text-slate-400 mt-1.5">
                    Last crawled: <span className="text-slate-600 font-medium">{formatTimestamp(crawledAt)}</span>
                  </p>
                  {crawlMsg && (
                    <p className={`text-xs mt-2 ${crawlMsg.startsWith('✓') ? 'text-emerald-700' : 'text-red-600'}`}>
                      {crawlMsg}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={recrawl}
                  disabled={crawling}
                  className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-slate-700 hover:text-slate-900 rounded-lg transition-colors"
                >
                  {crawling ? (
                    <>
                      <span className="w-3 h-3 border border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                      Crawling…
                    </>
                  ) : (
                    '↺ Re-crawl site'
                  )}
                </button>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Reference URLs */}
            <div>
              <p className="text-sm font-medium mb-1">Reference sites</p>
              <p className="text-xs text-slate-400 mb-4">
                Add up to 3 competitor or inspiration sites. Clem crawls these and uses them
                to identify content gaps and differentiated angles for your blog suggestions.
                Crawls are billed against your Firecrawl quota — only crawl when needed.
              </p>

              {/* Existing reference URLs */}
              <div className="space-y-3 mb-4">
                {referenceUrls.map((url) => {
                  const summary = referenceSummaries.find((r) => r.url === url)
                  const isCrawling = refCrawling[url] ?? false
                  const msg = refCrawlMsgs[url] ?? ''
                  return (
                    <div key={url} className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-800 font-mono truncate">{url}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Last crawled:{' '}
                          <span className="text-slate-600">{formatTimestamp(summary?.crawled_at ?? null)}</span>
                        </p>
                        {msg && (
                          <p className={`text-xs mt-1 ${msg.startsWith('✓') ? 'text-emerald-700' : 'text-red-600'}`}>
                            {msg}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => crawlReferenceUrl(url)}
                          disabled={isCrawling}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-slate-700 rounded-lg transition-colors"
                        >
                          {isCrawling ? (
                            <>
                              <span className="w-2.5 h-2.5 border border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                              Crawling…
                            </>
                          ) : (
                            '↺ Crawl'
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeReferenceUrl(url)}
                          className="px-2 py-1.5 text-xs text-slate-300 hover:text-red-500 transition-colors rounded-lg"
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Add reference URL */}
              {referenceUrls.length < 3 ? (
                <div className="flex gap-2">
                  <input
                    className={`${inputClass} flex-1`}
                    value={newRefUrl}
                    onChange={(e) => setNewRefUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addReferenceUrl()}
                    placeholder="competitor.com"
                  />
                  <button
                    type="button"
                    onClick={addReferenceUrl}
                    disabled={!newRefUrl.trim()}
                    className="px-4 py-2 text-sm bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-slate-700 rounded-lg transition-colors shrink-0"
                  >
                    + Add
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-400">Maximum of 3 reference sites reached.</p>
              )}

              {/* Save reference URLs */}
              <div className="flex items-center gap-3 mt-3">
                <button
                  type="button"
                  onClick={saveReferenceUrls}
                  disabled={savingRefUrls}
                  className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg transition-colors"
                >
                  {savingRefUrls ? 'Saving…' : 'Save reference URLs'}
                </button>
                {refUrlMsg && (
                  <p className={`text-xs ${refUrlMsg.startsWith('✓') ? 'text-emerald-700' : 'text-red-600'}`}>
                    {refUrlMsg}
                  </p>
                )}
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Generate suggestions */}
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Generate blog suggestions</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Ask Clem to propose 5 new article ideas based on your site crawl
                    {referenceSummaries.length > 0
                      ? ' and your reference sites'
                      : ''}.
                    Results appear in the <strong>Pending suggestions</strong> section on the Dashboard.
                  </p>
                  {suggestMsg && (
                    <p className={`text-xs mt-2 ${suggestMsg.startsWith('✓') ? 'text-emerald-700' : 'text-red-600'}`}>
                      {suggestMsg}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={generateSuggestions}
                  disabled={suggesting || !crawledAt}
                  className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg transition-colors"
                  title={!crawledAt ? 'Crawl your site first' : undefined}
                >
                  {suggesting ? (
                    <>
                      <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                      Generating…
                    </>
                  ) : (
                    '✦ Generate suggestions'
                  )}
                </button>
              </div>
              {!crawledAt && (
                <p className="text-xs text-amber-600 mt-2">
                  Crawl your site first so Clem has content to work from.
                </p>
              )}
            </div>

            {/* ── Blog design match ── */}
            <div className="border-t border-slate-800 pt-6 space-y-4">
              <div>
                <p className="text-sm font-medium">Blog design match</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Clem scrapes your website homepage and extracts your brand colours, fonts, logo, and
                  navigation so your hosted blog matches your site automatically.
                  {blogTheme?.extractedAt && (
                    <> Last extracted: <span className="text-slate-300">{formatTimestamp(blogTheme.extractedAt)}</span></>
                  )}
                </p>
              </div>

              {/* Admin-only: extract design tokens */}
              {isAdmin && (
                <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-medium">Extract design tokens</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Scrapes <span className="text-slate-300">{tenant.domain}</span> and applies brand
                      colours, fonts, and logo to your hosted blog.
                    </p>
                    {extractMsg && (
                      <p className={`text-xs mt-2 ${extractMsg.startsWith('✓') ? 'text-emerald-500' : 'text-red-400'}`}>
                        {extractMsg}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={extracting}
                    onClick={async () => {
                      setExtracting(true)
                      setExtractMsg('')
                      try {
                        const res = await fetch('/api/clem/extract-theme', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            tenantId: tenant.id,
                            url: extractUrl.trim() || undefined,
                          }),
                        })
                        const data = await res.json()
                        if (!res.ok) throw new Error(data.error ?? 'Extraction failed')
                        setBlogTheme(data.theme)
                        setNavLinks(data.theme.navLinks ?? [])
                        setExtractMsg('✓ Design tokens extracted')
                        router.refresh()
                      } catch (err) {
                        setExtractMsg(err instanceof Error ? err.message : 'Extraction failed')
                      } finally {
                        setExtracting(false)
                      }
                    }}
                    className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg transition-colors"
                  >
                    {extracting ? (
                      <>
                        <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                        Extracting…
                      </>
                    ) : (
                      '⬡ Extract design match'
                    )}
                  </button>
                </div>
                {/* Optional URL override */}
                <div>
                  <label className={labelClass}>Design match source URL (optional)</label>
                  <div className="flex gap-2">
                    <input
                      className={inputClass}
                      value={extractUrl}
                      onChange={(e) => setExtractUrl(e.target.value)}
                      placeholder={`Defaults to ${tenant.domain}`}
                    />
                    <button
                      type="button"
                      disabled={savingExtractUrl}
                      onClick={async () => {
                        setSavingExtractUrl(true)
                        await fetch('/api/tenant', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ theme_extract_url: extractUrl.trim() || null }),
                        })
                        setSavingExtractUrl(false)
                        router.refresh()
                      }}
                      className="shrink-0 px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg transition-colors"
                    >
                      {savingExtractUrl ? 'Saving…' : 'Save'}
                    </button>
                    {extractUrl && (
                      <button
                        type="button"
                        onClick={async () => {
                          setExtractUrl('')
                          await fetch('/api/tenant', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ theme_extract_url: null }),
                          })
                          router.refresh()
                        }}
                        className="shrink-0 px-3 py-2 text-sm border border-slate-200 hover:border-red-300 hover:text-red-500 text-slate-500 rounded-lg transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Leave blank to extract from your main domain. Enter a staging or preview URL if the client is preparing a new design.
                  </p>
                </div>
                </div>
              )}

              {/* Colour / font preview */}
              {blogTheme && (
                <div className="rounded-lg border border-slate-700 p-4 space-y-3">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Current theme</p>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { label: 'Primary', value: blogTheme.primaryColor },
                      { label: 'Background', value: blogTheme.backgroundColor },
                      { label: 'Text', value: blogTheme.textColor },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center gap-2">
                        <div
                          className="w-5 h-5 rounded border border-white/20 flex-shrink-0"
                          style={{ backgroundColor: value }}
                        />
                        <span className="text-xs text-slate-400">{label}: <span className="font-mono text-slate-300">{value}</span></span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400">
                    Heading font: <span className="text-slate-300">{blogTheme.headingFont}</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    Body font: <span className="text-slate-300">{blogTheme.bodyFont}</span>
                  </p>
                </div>
              )}

              {/* Nav links — editable by all users */}
              <div>
                <p className="text-sm font-medium mb-2">Blog header navigation</p>
                <p className="text-xs text-slate-400 mb-3">
                  These links appear in the header of your hosted blog alongside the Blog link.
                  Edit them to match your site&apos;s main navigation.
                </p>
                <div className="space-y-2 mb-3">
                  {navLinks.map((link, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                        value={link.label}
                        onChange={(e) => {
                          const updated = [...navLinks]
                          updated[i] = { ...updated[i], label: e.target.value }
                          setNavLinks(updated)
                        }}
                        placeholder="Label"
                      />
                      <input
                        className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                        value={link.url}
                        onChange={(e) => {
                          const updated = [...navLinks]
                          updated[i] = { ...updated[i], url: e.target.value }
                          setNavLinks(updated)
                        }}
                        placeholder="https://..."
                      />
                      <button
                        type="button"
                        onClick={() => setNavLinks(navLinks.filter((_, j) => j !== i))}
                        className="px-2 py-1.5 text-slate-400 hover:text-red-500 text-sm"
                        aria-label="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                {navLinks.length < 8 && (
                  <div className="flex gap-2 mb-3">
                    <input
                      className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                      value={newNavLabel}
                      onChange={(e) => setNewNavLabel(e.target.value)}
                      placeholder="Label"
                    />
                    <input
                      className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                      value={newNavUrl}
                      onChange={(e) => setNewNavUrl(e.target.value)}
                      placeholder="https://..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newNavLabel && newNavUrl) {
                          setNavLinks([...navLinks, { label: newNavLabel, url: newNavUrl }])
                          setNewNavLabel('')
                          setNewNavUrl('')
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newNavLabel && newNavUrl) {
                          setNavLinks([...navLinks, { label: newNavLabel, url: newNavUrl }])
                          setNewNavLabel('')
                          setNewNavUrl('')
                        }
                      }}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors"
                    >
                      Add
                    </button>
                  </div>
                )}
                {navMsg && (
                  <p className={`text-xs mb-2 ${navMsg.startsWith('✓') ? 'text-emerald-500' : 'text-red-400'}`}>
                    {navMsg}
                  </p>
                )}
                <button
                  type="button"
                  disabled={savingNav}
                  onClick={async () => {
                    setSavingNav(true)
                    setNavMsg('')
                    try {
                      // Merge updated nav links into the existing blog_theme
                      const updatedTheme = blogTheme
                        ? { ...blogTheme, navLinks }
                        : { navLinks }
                      const res = await fetch('/api/tenant', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ blog_theme: updatedTheme }),
                      })
                      const data = await res.json()
                      if (!res.ok) throw new Error(data.error ?? 'Save failed')
                      setBlogTheme(updatedTheme as BlogTheme)
                      setNavMsg('✓ Navigation saved')
                      router.refresh()
                    } catch (err) {
                      setNavMsg(err instanceof Error ? err.message : 'Save failed')
                    } finally {
                      setSavingNav(false)
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg transition-colors"
                >
                  {savingNav ? 'Saving…' : 'Save navigation'}
                </button>
              </div>
            </div>

          </div>
        )}

        {/* ── Brand ── */}
        {section === 'brand' && (
          <>
            <div>
              <label className={labelClass}>Brand voice</label>
              <textarea
                className={`${inputClass} resize-none`}
                rows={4}
                value={brandVoice}
                onChange={(e) => setBrandVoice(e.target.value)}
                placeholder="Friendly, expert, approachable. Speak to small business owners who want quality custom print without the jargon."
              />
              <p className="text-xs text-slate-300 mt-1">Clem injects this into every prompt. Be specific about tone, style, and what to avoid.</p>
            </div>
            <div>
              <label className={labelClass}>Target audience</label>
              <textarea
                className={`${inputClass} resize-none`}
                rows={2}
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="UK small business owners, event organisers, marketers needing custom print"
              />
            </div>
            <div>
              <label className={labelClass}>Forbidden words (comma-separated)</label>
              <input
                className={inputClass}
                value={forbiddenWords}
                onChange={(e) => setForbiddenWords(e.target.value)}
                placeholder="synergy, leverage, utilize, game-changer"
              />
              <p className="text-xs text-slate-300 mt-1">Words or phrases Clem must never use</p>
            </div>
          </>
        )}

        {/* ── Publishing ── */}
        {section === 'publishing' && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Automatic publishing</p>
                <p className="text-xs text-slate-400 mt-0.5">Clem auto-schedules posts on your cadence</p>
              </div>
              <button
                onClick={() => setCadenceActive(!cadenceActive)}
                className={`w-11 h-6 rounded-full transition-colors relative ${cadenceActive ? 'bg-indigo-600' : 'bg-white/20'}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${cadenceActive ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <div>
              <label className={labelClass}>Cadence</label>
              <div className="flex flex-wrap gap-2">
                {CADENCE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setCadence(opt)}
                    className={`px-4 py-1.5 text-xs rounded-lg border transition-colors ${
                      cadence === opt
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-white border-slate-200 text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {opt === '1pw' ? '1× per week' :
                     opt === '2pw' ? '2× per week' :
                     opt === '3pw' ? '3× per week' :
                     opt === '5pw' ? '5× per week' : 'Daily'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelClass}>Preferred days</label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OPTIONS.map((day) => (
                  <button
                    key={day}
                    onClick={() => toggleDay(day)}
                    className={`px-3 py-1.5 text-xs rounded-lg border capitalize transition-colors ${
                      days.includes(day)
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-white border-slate-200 text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelClass}>Publish time (local)</label>
              <input
                type="time"
                className={`${inputClass} w-40`}
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>

            <hr className="border-slate-200" />

            <div>
              <label className={labelClass}>Export / publish method</label>
              <div className="space-y-2">
                {CMS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setCmsType(opt.value)}
                    className={`w-full flex items-start gap-3 text-left px-4 py-3 rounded-xl border transition-colors ${
                      cmsType === opt.value
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-indigo-200'
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full border-2 mt-0.5 shrink-0 ${cmsType === opt.value ? 'border-indigo-400 bg-indigo-400' : 'border-white/30'}`} />
                    <div>
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{opt.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {cmsType === 'git' && (
              <div className="space-y-4 pt-2">
                <div>
                  <label className={labelClass}>GitHub repo (owner/repo)</label>
                  <input className={inputClass} value={gitRepo} onChange={(e) => setGitRepo(e.target.value)} placeholder="standr80/designsonprint" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Branch</label>
                    <input className={inputClass} value={gitBranch} onChange={(e) => setGitBranch(e.target.value)} placeholder="main" />
                  </div>
                  <div>
                    <label className={labelClass}>Blog path</label>
                    <input className={inputClass} value={gitBlogPath} onChange={(e) => setGitBlogPath(e.target.value)} placeholder="content/blog" />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Team ── */}
        {section === 'team' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Team members</h3>
              {isAdmin && !showAddMember && (
                <button
                  onClick={() => { setShowAddMember(true); setInviteResult(null) }}
                  className="text-xs text-indigo-600 hover:text-indigo-600 transition-colors"
                >
                  + Invite member
                </button>
              )}
            </div>

            {showAddMember && (
              <div className="bg-indigo-500/5 border border-indigo-200 rounded-xl p-4 space-y-3">
                {inviteResult ? (
                  <div className="space-y-3">
                    {inviteResult.emailSent ? (
                      <>
                        <p className="text-sm text-emerald-700 font-medium">✓ Invite email sent!</p>
                        <p className="text-xs text-slate-400">
                          They&apos;ll receive an email with a link to join this workspace.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-amber-700 font-medium">⚠ Invite created — email failed to send</p>
                        <p className="text-xs text-slate-400">
                          The invite is valid. Share this link manually:
                        </p>
                        <div className="flex items-center gap-2">
                          <input
                            readOnly
                            value={inviteResult.inviteUrl}
                            className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 font-mono truncate"
                          />
                          <button
                            onClick={() => navigator.clipboard.writeText(inviteResult.inviteUrl)}
                            className="shrink-0 px-3 py-2 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                          >
                            Copy
                          </button>
                        </div>
                        <p className="text-xs text-slate-400">
                          To fix email delivery, check your <code>RESEND_API_KEY</code> and <code>RESEND_FROM_EMAIL</code> environment variables in Vercel.
                        </p>
                      </>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => { setInviteResult(null); setAddEmail('') }}
                        className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                      >
                        Send another
                      </button>
                      <button
                        onClick={() => { setShowAddMember(false); setInviteResult(null) }}
                        className="px-4 py-1.5 text-xs text-slate-400 hover:text-slate-900 rounded-lg transition-colors"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-xs font-medium text-indigo-600">Invite a team member</p>
                    <p className="text-xs text-slate-400">
                      An email invitation will be sent. If they don&apos;t have a Clem account yet,
                      they&apos;ll be prompted to create one first.
                    </p>
                    <div>
                      <label className={labelClass}>Email address</label>
                      <input
                        autoFocus
                        type="email"
                        className={inputClass}
                        value={addEmail}
                        onChange={(e) => setAddEmail(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendInvite()}
                        placeholder="colleague@example.com"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Role</label>
                      <div className="flex gap-2">
                        {(['author', 'reviewer', 'admin'] as const).map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setAddRole(r)}
                            className={`px-4 py-1.5 text-xs rounded-lg border capitalize transition-colors ${
                              addRole === r
                                ? 'bg-indigo-600 border-indigo-500 text-white'
                                : 'bg-white border-slate-200 text-slate-500 hover:text-slate-900'
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-slate-300 mt-1.5">
                        Author — can draft and edit · Reviewer — can approve · Admin — full access
                      </p>
                    </div>
                    {addMemberError && <p className="text-xs text-red-600">{addMemberError}</p>}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={sendInvite}
                        disabled={addingMember || !addEmail.trim()}
                        className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg transition-colors"
                      >
                        {addingMember ? 'Sending…' : 'Send invite'}
                      </button>
                      <button
                        onClick={() => { setShowAddMember(false); setAddEmail(''); setAddMemberError('') }}
                        className="px-4 py-1.5 text-xs text-slate-400 hover:text-slate-900 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            <ul className="space-y-2">
              {memberList.map((m) => (
                <li key={m.id} className="flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-slate-200">
                  <div>
                    <p className="text-sm text-slate-900">{m.name ?? m.email ?? m.clerk_user_id}</p>
                    {m.email && m.name && <p className="text-xs text-slate-400 mt-0.5">{m.email}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full border capitalize ${
                      m.role === 'admin'
                        ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
                        : m.role === 'reviewer'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-white text-slate-500 border-slate-200'
                    }`}>
                      {m.role}
                    </span>
                    {isAdmin && (
                      <button
                        onClick={() => removeMember(m.id)}
                        disabled={removingId === m.id}
                        className="text-xs text-slate-300 hover:text-red-600 transition-colors disabled:opacity-30 ml-1"
                        title="Remove member"
                      >
                        {removingId === m.id ? '…' : '✕'}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Embed ── */}
        {section === 'embed' && (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium mb-1">Your tenant slug</p>
              <p className="font-mono text-sm text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 inline-block">
                {tenantSlug}
              </p>
              <p className="text-xs text-slate-400 mt-1">Derived from <span className="font-mono">{tenant.domain}</span></p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Mode</label>
                <select className={inputClass} value={embedMode} onChange={(e) => setEmbedMode(e.target.value)}>
                  <option value="feed">Feed (grid of cards)</option>
                  <option value="latest">Latest post</option>
                  <option value="single">Single post by slug</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Theme</label>
                <select className={inputClass} value={embedTheme} onChange={(e) => setEmbedTheme(e.target.value)}>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="auto">Auto (system)</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Accent colour</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={embedAccent} onChange={(e) => setEmbedAccent(e.target.value)} className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white" />
                  <input className={`${inputClass} flex-1`} value={embedAccent} onChange={(e) => setEmbedAccent(e.target.value)} placeholder="#2563eb" />
                </div>
              </div>
              <div>
                <label className={labelClass}>Post limit</label>
                <input type="number" min={1} max={50} className={inputClass} value={embedLimit} onChange={(e) => setEmbedLimit(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Open posts</label>
                <select className={inputClass} value={embedOpen} onChange={(e) => setEmbedOpen(e.target.value)}>
                  <option value="same-tab">Same tab</option>
                  <option value="new-tab">New tab</option>
                  <option value="modal">Modal overlay</option>
                </select>
              </div>
              <div className="space-y-3 pt-1">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <button type="button" onClick={() => setEmbedShowImages(!embedShowImages)} className={`w-10 h-5 rounded-full transition-colors relative ${embedShowImages ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${embedShowImages ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                  <span className="text-sm text-slate-700">Show images</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <button type="button" onClick={() => setEmbedShowAuthor(!embedShowAuthor)} className={`w-10 h-5 rounded-full transition-colors relative ${embedShowAuthor ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${embedShowAuthor ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                  <span className="text-sm text-slate-700">Show author</span>
                </label>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={labelClass}>Script tag</label>
                <button type="button" onClick={copyEmbed} className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors">
                  {embedCopied ? '✓ Copied!' : 'Copy snippet'}
                </button>
              </div>
              <pre className="bg-slate-900 text-slate-100 text-xs rounded-xl p-4 overflow-x-auto leading-relaxed font-mono whitespace-pre">
                {embedSnippet()}
              </pre>
            </div>

            <div>
              <label className={labelClass}>Live preview</label>
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50" style={{ height: 420 }}>
                <iframe
                  key={`${tenantSlug}-${embedTheme}-${embedAccent}-${embedMode}-${embedLimit}-${embedOpen}-${embedShowImages}-${embedShowAuthor}`}
                  src={`/preview/embed/${tenantSlug}?theme=${embedTheme}&accent=${encodeURIComponent(embedAccent)}&mode=${embedMode}&limit=${embedLimit}&open=${embedOpen}&show-images=${embedShowImages}&show-author=${embedShowAuthor}`}
                  className="w-full h-full border-0"
                  title="Embed preview"
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
            </div>
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      {/* Save button — shown for settings sections that use the main save */}
      {(section === 'basics' || section === 'brand' || section === 'publishing') && isAdmin && (
        <div className="flex justify-end pt-4">
          <button
            onClick={save}
            disabled={saving}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save changes'}
          </button>
        </div>
      )}
    </div>
  )
}
