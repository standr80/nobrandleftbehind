'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Suggestion {
  id: string
  proposed_title: string
  rationale: string | null
  target_keywords: string[] | null
  status: string | null
}

interface Props {
  suggestions: Suggestion[]
  tenantId: string
}

// ── Inline edit form for a single suggestion ──────────────────────────────────

interface EditFormProps {
  suggestion: Suggestion
  onSave: (updated: Suggestion) => void
  onCancel: () => void
}

function EditForm({ suggestion, onSave, onCancel }: EditFormProps) {
  const [title, setTitle] = useState(suggestion.proposed_title)
  const [rationale, setRationale] = useState(suggestion.rationale ?? '')
  const [keywords, setKeywords] = useState((suggestion.target_keywords ?? []).join(', '))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!title.trim()) return
    setSaving(true)
    setError('')
    try {
      const kwArray = keywords.split(',').map((k) => k.trim()).filter(Boolean)
      const res = await fetch(`/api/suggestions/${suggestion.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposed_title: title.trim(),
          rationale: rationale.trim() || null,
          target_keywords: kwArray,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      onSave({ ...suggestion, proposed_title: title.trim(), rationale: rationale.trim() || null, target_keywords: kwArray })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      setSaving(false)
    }
  }

  const inputClass = 'w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors'

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-slate-400 mb-1 block">Title</label>
        <input
          autoFocus
          className={inputClass}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="Post title"
        />
      </div>
      <div>
        <label className="text-xs text-slate-400 mb-1 block">Rationale</label>
        <textarea
          className={`${inputClass} resize-none`}
          rows={2}
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="Why is this a good idea?"
        />
      </div>
      <div>
        <label className="text-xs text-slate-400 mb-1 block">Keywords (comma-separated)</label>
        <input
          className={inputClass}
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="custom print, marketing, small business"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button
          onClick={save}
          disabled={saving || !title.trim()}
          className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg transition-colors"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-1.5 text-xs text-slate-400 hover:text-slate-900 rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Add suggestion form ───────────────────────────────────────────────────────

interface AddFormProps {
  onAdd: (s: Suggestion) => void
  onCancel: () => void
}

function AddForm({ onAdd, onCancel }: AddFormProps) {
  const [title, setTitle] = useState('')
  const [rationale, setRationale] = useState('')
  const [keywords, setKeywords] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!title.trim()) return
    setSaving(true)
    setError('')
    try {
      const kwArray = keywords.split(',').map((k) => k.trim()).filter(Boolean)
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposed_title: title.trim(),
          rationale: rationale.trim() || null,
          target_keywords: kwArray,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to add')
      onAdd({ id: data.id, proposed_title: title.trim(), rationale: rationale.trim() || null, target_keywords: kwArray, status: 'pending' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add')
      setSaving(false)
    }
  }

  const inputClass = 'w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors'

  return (
    <li className="px-6 py-4 bg-indigo-500/5 border-b border-slate-100">
      <p className="text-xs font-medium text-indigo-600 mb-3">New suggestion</p>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Title</label>
          <input
            autoFocus
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder="Post title idea"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Rationale (optional)</label>
          <textarea
            className={`${inputClass} resize-none`}
            rows={2}
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder="Why is this worth writing?"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Keywords (optional, comma-separated)</label>
          <input
            className={inputClass}
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="custom print, marketing"
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button
            onClick={save}
            disabled={saving || !title.trim()}
            className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg transition-colors"
          >
            {saving ? 'Adding…' : 'Add suggestion'}
          </button>
          <button onClick={onCancel} className="px-4 py-1.5 text-xs text-slate-400 hover:text-slate-900 rounded-lg transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </li>
  )
}

// ── Main list ─────────────────────────────────────────────────────────────────

export default function SuggestionsList({ suggestions: initialSuggestions, tenantId }: Props) {
  const router = useRouter()
  const [items, setItems] = useState<Suggestion[]>(
    initialSuggestions.filter((s) => s.status === 'pending'),
  )
  const [drafting, setDrafting] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!items.length && !showAddForm) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl px-6 py-4 flex items-center justify-between">
        <p className="text-sm text-slate-400">No pending suggestions</p>
        <button
          onClick={() => setShowAddForm(true)}
          className="text-xs text-indigo-600 hover:text-indigo-600 transition-colors"
        >
          + Add your own
        </button>
      </div>
    )
  }

  async function handleDraft(suggestionId: string) {
    setDrafting(suggestionId)
    setError(null)
    try {
      const res = await fetch('/api/clem/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, suggestionId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Draft failed')
      router.push(data.postId ? `/author/${data.postId}` : '/author')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setDrafting(null)
    }
  }

  async function handleReject(suggestionId: string) {
    setRejecting(suggestionId)
    setError(null)
    try {
      const res = await fetch(`/api/suggestions/${suggestionId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to reject')
      setItems((prev) => prev.filter((s) => s.id !== suggestionId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setRejecting(null)
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-700">
          Pending suggestions
          <span className="ml-2 text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">
            {items.length}
          </span>
        </h2>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="text-xs text-indigo-600 hover:text-indigo-600 transition-colors"
          >
            + Add your own
          </button>
        )}
      </div>

      <ul className="divide-y divide-slate-100">
        {/* Add form at top */}
        {showAddForm && (
          <AddForm
            onAdd={(s) => { setItems((prev) => [s, ...prev]); setShowAddForm(false) }}
            onCancel={() => setShowAddForm(false)}
          />
        )}

        {items.map((s) => (
          <li key={s.id} className="px-6 py-4">
            {editing === s.id ? (
              <EditForm
                suggestion={s}
                onSave={(updated) => { setItems((prev) => prev.map((x) => x.id === s.id ? updated : x)); setEditing(null) }}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{s.proposed_title}</p>
                  {s.rationale && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{s.rationale}</p>
                  )}
                  {s.target_keywords?.length ? (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {s.target_keywords.map((kw) => (
                        <span key={kw} className="text-xs bg-white text-slate-400 px-2 py-0.5 rounded">
                          {kw}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setEditing(s.id)}
                    disabled={drafting === s.id || rejecting === s.id}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-30"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleReject(s.id)}
                    disabled={drafting === s.id || rejecting === s.id}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30"
                  >
                    {rejecting === s.id ? '…' : 'Dismiss'}
                  </button>
                  <button
                    onClick={() => handleDraft(s.id)}
                    disabled={drafting !== null || rejecting === s.id}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/40 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                  >
                    {drafting === s.id ? (
                      <>
                        <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                        Writing…
                      </>
                    ) : (
                      '✎ Draft this'
                    )}
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {error && (
        <div className="px-6 py-3 border-t border-slate-200">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}
    </div>
  )
}
