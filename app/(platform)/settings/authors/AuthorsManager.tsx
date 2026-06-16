'use client'

import { useState } from 'react'

export interface AuthorLink {
  label: string
  url: string
}

export interface Author {
  id: string
  name: string
  slug: string
  job_title: string | null
  bio: string | null
  links: AuthorLink[] | null
  is_default: boolean | null
  created_at?: string | null
}

interface Props {
  initialAuthors: Author[]
  isAdmin: boolean
}

const inputClass =
  'w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors'
const labelClass = 'block text-xs text-slate-500 mb-1.5'

interface Draft {
  name: string
  job_title: string
  bio: string
  links: AuthorLink[]
  is_default: boolean
}

function emptyDraft(): Draft {
  return { name: '', job_title: '', bio: '', links: [{ label: '', url: '' }], is_default: false }
}

function toDraft(a: Author): Draft {
  return {
    name: a.name,
    job_title: a.job_title ?? '',
    bio: a.bio ?? '',
    links: (a.links && a.links.length ? a.links : [{ label: '', url: '' }]).map((l) => ({ ...l })),
    is_default: !!a.is_default,
  }
}

export default function AuthorsManager({ initialAuthors, isAdmin }: Props) {
  const [authors, setAuthors] = useState<Author[]>(initialAuthors)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function startCreate() {
    setDraft(emptyDraft())
    setCreating(true)
    setEditingId(null)
    setError('')
  }
  function startEdit(a: Author) {
    setDraft(toDraft(a))
    setEditingId(a.id)
    setCreating(false)
    setError('')
  }
  function cancel() {
    setCreating(false)
    setEditingId(null)
    setError('')
  }

  function setLink(i: number, key: keyof AuthorLink, value: string) {
    setDraft((d) => {
      const links = d.links.map((l, idx) => (idx === i ? { ...l, [key]: value } : l))
      return { ...d, links }
    })
  }
  function addLinkRow() {
    setDraft((d) => ({ ...d, links: [...d.links, { label: '', url: '' }] }))
  }
  function removeLinkRow(i: number) {
    setDraft((d) => ({ ...d, links: d.links.filter((_, idx) => idx !== i) }))
  }

  async function save() {
    if (!draft.name.trim()) { setError('Name is required'); return }
    setBusy(true)
    setError('')
    const payload = {
      name: draft.name.trim(),
      job_title: draft.job_title.trim() || null,
      bio: draft.bio.trim() || null,
      links: draft.links.filter((l) => l.url.trim()).map((l) => ({ label: l.label.trim(), url: l.url.trim() })),
      is_default: draft.is_default,
    }
    try {
      const res = await fetch(
        editingId ? `/api/authors/${editingId}` : '/api/authors',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Save failed'); setBusy(false); return }
      const saved: Author = json.author
      setAuthors((list) => {
        let next = editingId ? list.map((a) => (a.id === saved.id ? saved : a)) : [...list, saved]
        if (saved.is_default) next = next.map((a) => (a.id === saved.id ? a : { ...a, is_default: false }))
        return next.sort((a, b) => a.name.localeCompare(b.name))
      })
      cancel()
    } catch {
      setError('Network error')
    }
    setBusy(false)
  }

  async function remove(a: Author) {
    if (!confirm(`Remove author "${a.name}"? Their articles stay published but become unattributed.`)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/authors/${a.id}`, { method: 'DELETE' })
      if (res.ok) setAuthors((list) => list.filter((x) => x.id !== a.id))
    } finally {
      setBusy(false)
    }
  }

  const showForm = creating || editingId !== null

  return (
    <div className="space-y-4">
      {!isAdmin && (
        <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          Only workspace admins can add or edit authors.
        </p>
      )}

      {/* Author list */}
      <div className="space-y-3">
        {authors.length === 0 && !showForm && (
          <p className="text-sm text-slate-400">No authors yet. Add your first author below.</p>
        )}
        {authors.map((a) => (
          <div key={a.id} className="border border-slate-200 rounded-xl p-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 text-sm">
                {a.name}
                {a.job_title && <span className="font-normal text-slate-500"> · {a.job_title}</span>}
                {a.is_default && <span className="ml-2 text-[11px] font-medium text-indigo-600 bg-indigo-50 rounded px-1.5 py-0.5">Default</span>}
              </p>
              {a.bio && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{a.bio}</p>}
              {a.links && a.links.length > 0 && (
                <p className="text-xs text-slate-400 mt-1 truncate">{a.links.map((l) => l.label || l.url).join(' · ')}</p>
              )}
            </div>
            {isAdmin && (
              <div className="flex gap-2 shrink-0">
                <button onClick={() => startEdit(a)} className="text-xs text-slate-500 hover:text-slate-900">Edit</button>
                <button onClick={() => remove(a)} disabled={busy} className="text-xs text-red-500 hover:text-red-700">Remove</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add button */}
      {isAdmin && !showForm && (
        <button onClick={startCreate} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
          + Add author
        </button>
      )}

      {/* Create / edit form */}
      {isAdmin && showForm && (
        <div className="border border-slate-200 rounded-xl p-5 space-y-4 bg-slate-50">
          <h3 className="font-semibold text-sm text-slate-900">{editingId ? 'Edit author' : 'New author'}</h3>
          <div>
            <label className={labelClass}>Name *</label>
            <input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Richard Standen" />
          </div>
          <div>
            <label className={labelClass}>Job title / credentials</label>
            <input className={inputClass} value={draft.job_title} onChange={(e) => setDraft({ ...draft, job_title: e.target.value })} placeholder="e.g. Events Specialist, 10+ years" />
          </div>
          <div>
            <label className={labelClass}>Bio</label>
            <textarea className={inputClass} rows={3} value={draft.bio} onChange={(e) => setDraft({ ...draft, bio: e.target.value })} placeholder="A short author biography shown under each article." />
          </div>
          <div>
            <label className={labelClass}>Profile links (used as schema.org sameAs)</label>
            <div className="space-y-2">
              {draft.links.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <input className={inputClass + ' flex-[0_0_30%]'} value={l.label} onChange={(e) => setLink(i, 'label', e.target.value)} placeholder="LinkedIn" />
                  <input className={inputClass} value={l.url} onChange={(e) => setLink(i, 'url', e.target.value)} placeholder="https://linkedin.com/in/..." />
                  <button onClick={() => removeLinkRow(i)} className="text-slate-400 hover:text-red-500 px-2" aria-label="Remove link">×</button>
                </div>
              ))}
            </div>
            <button onClick={addLinkRow} className="text-xs text-indigo-600 hover:text-indigo-800 mt-2">+ Add link</button>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={draft.is_default} onChange={(e) => setDraft({ ...draft, is_default: e.target.checked })} />
            Default author (used when an article has none assigned)
          </label>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button onClick={save} disabled={busy} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg px-4 py-2 disabled:opacity-50">
              {busy ? 'Saving…' : editingId ? 'Save changes' : 'Add author'}
            </button>
            <button onClick={cancel} disabled={busy} className="text-sm text-slate-500 hover:text-slate-900 px-3">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
