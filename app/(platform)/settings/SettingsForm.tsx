'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
}

type Section = 'basics' | 'brand' | 'publishing' | 'team'

export default function SettingsForm({ tenant, members: initialMembers, isAdmin }: Props) {
  const router = useRouter()
  const [section, setSection] = useState<Section>('basics')
  const [crawling, setCrawling] = useState(false)
  const [crawlMsg, setCrawlMsg] = useState('')
  // Team state
  const [memberList, setMemberList] = useState<Member[]>(initialMembers)
  const [showAddMember, setShowAddMember] = useState(false)
  const [addEmail, setAddEmail] = useState('')
  const [addRole, setAddRole] = useState<'author' | 'reviewer' | 'admin'>('author')
  const [addingMember, setAddingMember] = useState(false)
  const [addMemberError, setAddMemberError] = useState('')
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

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
      setCrawlMsg('✓ Site crawled — new suggestions will use fresh content')
    } catch (err) {
      setCrawlMsg(err instanceof Error ? err.message : 'Crawl failed')
    } finally {
      setCrawling(false)
    }
  }

  async function addMember() {
    if (!addEmail.trim()) return
    setAddingMember(true)
    setAddMemberError('')
    try {
      const res = await fetch('/api/tenant/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: addEmail.trim(), role: addRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to add member')
      setMemberList((prev) => [...prev, data.member])
      setAddEmail('')
      setAddRole('author')
      setShowAddMember(false)
    } catch (err) {
      setAddMemberError(err instanceof Error ? err.message : 'Failed to add member')
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

  const inputClass =
    'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 transition-colors'
  const labelClass = 'block text-xs text-white/50 mb-1.5'

  const sections: { id: Section; label: string }[] = [
    { id: 'basics', label: 'Basics' },
    { id: 'brand', label: 'Brand' },
    { id: 'publishing', label: 'Publishing' },
    { id: 'team', label: 'Team' },
  ]

  return (
    <div className="space-y-1">
      {/* Section nav */}
      <div className="flex gap-1 mb-6">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              section === s.id
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-white/40 hover:text-white'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-5">
        {/* Basics */}
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
              <label className={labelClass}>Billing tier</label>
              <p className="text-sm text-white/60 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 capitalize">
                {tenant.billing_tier ?? 'starter'}
              </p>
            </div>

            <div className="pt-2 border-t border-white/10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Site crawl</p>
                  <p className="text-xs text-white/40 mt-0.5">
                    Re-crawl the domain so Clem understands your current content. Always do this after changing the domain.
                  </p>
                  {crawlMsg && (
                    <p className={`text-xs mt-2 ${crawlMsg.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>
                      {crawlMsg}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={recrawl}
                  disabled={crawling}
                  className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-40 text-white/70 hover:text-white rounded-lg transition-colors"
                >
                  {crawling ? (
                    <>
                      <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                      Crawling…
                    </>
                  ) : (
                    '↺ Re-crawl site'
                  )}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Brand */}
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
              <p className="text-xs text-white/20 mt-1">Clem injects this into every prompt. Be specific about tone, style, and what to avoid.</p>
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
              <p className="text-xs text-white/20 mt-1">Words or phrases Clem must never use</p>
            </div>
          </>
        )}

        {/* Publishing */}
        {section === 'publishing' && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Automatic publishing</p>
                <p className="text-xs text-white/40 mt-0.5">Clem auto-schedules posts on your cadence</p>
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
                        : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
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
                        : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
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

            <hr className="border-white/10" />

            <div>
              <label className={labelClass}>Export / publish method</label>
              <div className="space-y-2">
                {CMS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setCmsType(opt.value)}
                    className={`w-full flex items-start gap-3 text-left px-4 py-3 rounded-xl border transition-colors ${
                      cmsType === opt.value
                        ? 'bg-indigo-600/20 border-indigo-500/50 text-white'
                        : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:border-white/20'
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full border-2 mt-0.5 shrink-0 ${cmsType === opt.value ? 'border-indigo-400 bg-indigo-400' : 'border-white/30'}`} />
                    <div>
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-xs text-white/40 mt-0.5">{opt.description}</p>
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

        {/* Team */}
        {section === 'team' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Team members</h3>
              {isAdmin && !showAddMember && (
                <button
                  onClick={() => setShowAddMember(true)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  + Add member
                </button>
              )}
            </div>

            {/* Add member form */}
            {showAddMember && (
              <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4 space-y-3">
                <p className="text-xs font-medium text-indigo-300">Add a team member</p>
                <p className="text-xs text-white/40">
                  They must already have a Clem account. Enter their email address and we&apos;ll link them automatically.
                </p>
                <div>
                  <label className={labelClass}>Email address</label>
                  <input
                    autoFocus
                    type="email"
                    className={inputClass}
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addMember()}
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
                            : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-white/20 mt-1.5">
                    Author — can draft and edit · Reviewer — can approve · Admin — full access
                  </p>
                </div>
                {addMemberError && <p className="text-xs text-red-400">{addMemberError}</p>}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={addMember}
                    disabled={addingMember || !addEmail.trim()}
                    className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg transition-colors"
                  >
                    {addingMember ? 'Adding…' : 'Add member'}
                  </button>
                  <button
                    onClick={() => { setShowAddMember(false); setAddEmail(''); setAddMemberError('') }}
                    className="px-4 py-1.5 text-xs text-white/40 hover:text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Member list */}
            <ul className="space-y-2">
              {memberList.map((m) => (
                <li key={m.id} className="flex items-center justify-between px-4 py-3 bg-white/5 rounded-xl border border-white/10">
                  <div>
                    <p className="text-sm text-white">{m.name ?? m.email ?? m.clerk_user_id}</p>
                    {m.email && m.name && <p className="text-xs text-white/40 mt-0.5">{m.email}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full border capitalize ${
                      m.role === 'admin'
                        ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                        : m.role === 'reviewer'
                          ? 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                          : 'bg-white/5 text-white/50 border-white/10'
                    }`}>
                      {m.role}
                    </span>
                    {isAdmin && (
                      <button
                        onClick={() => removeMember(m.id)}
                        disabled={removingId === m.id}
                        className="text-xs text-white/20 hover:text-red-400 transition-colors disabled:opacity-30 ml-1"
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

        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      {section !== 'team' && isAdmin && (
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
