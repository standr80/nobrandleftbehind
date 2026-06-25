'use client'

import { useState } from 'react'
import Link from 'next/link'

export interface FaqQuestion {
  id: string
  question: string
  source: string | null
  topic: string | null
  status: string | null
  used_in_post_id: string | null
  created_at: string | null
}

interface Props {
  initialQuestions: FaqQuestion[]
  tenantId: string
}

export default function FaqQuestionsManager({ initialQuestions, tenantId }: Props) {
  const [questions, setQuestions] = useState<FaqQuestion[]>(initialQuestions)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [newText, setNewText] = useState('')
  const [topic, setTopic] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generatedPostId, setGeneratedPostId] = useState<string | null>(null)

  const open = questions.filter((q) => q.status === 'open')
  const used = questions.filter((q) => q.status === 'used')
  const dismissed = questions.filter((q) => q.status === 'dismissed')

  async function refresh() {
    const res = await fetch('/api/faq/questions')
    if (res.ok) {
      const data = await res.json()
      setQuestions(data.questions ?? [])
    }
  }

  async function addQuestions() {
    const lines = newText.split('\n').map((l) => l.trim()).filter((l) => l.length > 3)
    if (!lines.length) return
    setBusy('add'); setError(null)
    try {
      const res = await fetch('/api/faq/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, questions: lines, topic: topic || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to add'); return }
      setNewText('')
      await refresh()
    } catch { setError('Network error') } finally { setBusy(null) }
  }

  async function importPaa() {
    setBusy('import'); setError(null)
    try {
      const res = await fetch('/api/faq/questions/import-paa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Import failed'); return }
      await refresh()
    } catch { setError('Network error') } finally { setBusy(null) }
  }

  async function setStatus(id: string, status: 'open' | 'dismissed') {
    setBusy(id)
    try {
      await fetch(`/api/faq/questions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, status }),
      })
      setSelected((s) => { const n = new Set(s); n.delete(id); return n })
      await refresh()
    } finally { setBusy(null) }
  }

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  async function generate() {
    if (!selected.size) return
    setBusy('generate'); setError(null); setGeneratedPostId(null)
    try {
      const res = await fetch('/api/clem/faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          questionIds: Array.from(selected),
          topic: topic || undefined,
          includeScoutPaa: false,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Generation failed'); return }
      setGeneratedPostId(data.postId)
      setSelected(new Set())
      await refresh()
    } catch { setError('Network error') } finally { setBusy(null) }
  }

  const sourceBadge = (s: string | null) =>
    s === 'scout_paa'
      ? <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 rounded px-1.5 py-0.5">SCOUT PAA</span>
      : <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">MANUAL</span>

  return (
    <div className="space-y-6">
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

      {generatedPostId && (
        <div className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          FAQ page drafted.{' '}
          <Link href={`/author/${generatedPostId}`} className="font-medium underline">Open it in the editor →</Link>
        </div>
      )}

      {/* Add / import */}
      <div className="border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Topic for this FAQ page (e.g. giant cheques)"
            className="flex-1 min-w-[200px] text-sm border border-slate-300 rounded-lg px-3 py-2"
          />
          <button
            onClick={importPaa}
            disabled={busy !== null}
            className="text-sm font-medium px-3 py-2 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
          >
            {busy === 'import' ? 'Importing…' : 'Import from Scout (PAA)'}
          </button>
        </div>
        <textarea
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Add your own questions, one per line…"
          rows={3}
          className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2"
        />
        <button
          onClick={addQuestions}
          disabled={busy !== null || newText.trim().length < 4}
          className="text-sm font-medium px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {busy === 'add' ? 'Adding…' : 'Add questions'}
        </button>
      </div>

      {/* Generate */}
      <div className="flex items-center justify-between gap-3 sticky top-0 bg-white py-2">
        <span className="text-sm text-slate-500">{selected.size} selected</span>
        <button
          onClick={generate}
          disabled={busy !== null || selected.size === 0}
          className="text-sm font-medium px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy === 'generate' ? 'Generating FAQ page…' : 'Generate FAQ page'}
        </button>
      </div>

      {/* Open questions */}
      <div>
        <h2 className="text-sm font-semibold text-slate-900 mb-2">Open questions ({open.length})</h2>
        {open.length === 0 ? (
          <p className="text-sm text-slate-400">No open questions. Add some above or import from Scout.</p>
        ) : (
          <ul className="space-y-1">
            {open.map((q) => (
              <li key={q.id} className="flex items-start gap-3 border border-slate-200 rounded-lg px-3 py-2">
                <input
                  type="checkbox"
                  checked={selected.has(q.id)}
                  onChange={() => toggle(q.id)}
                  className="mt-1"
                />
                <span className="flex-1 text-sm text-slate-800">{q.question}</span>
                {sourceBadge(q.source)}
                <button
                  onClick={() => setStatus(q.id, 'dismissed')}
                  disabled={busy !== null}
                  className="text-xs text-slate-400 hover:text-red-600 disabled:opacity-50"
                >
                  Dismiss
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Used */}
      {used.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-900 mb-2">Used in FAQ pages ({used.length})</h2>
          <ul className="space-y-1">
            {used.map((q) => (
              <li key={q.id} className="flex items-center gap-3 text-sm text-slate-500 px-3 py-1.5">
                <span className="flex-1">{q.question}</span>
                {q.used_in_post_id && (
                  <Link href={`/author/${q.used_in_post_id}`} className="text-xs text-indigo-600 underline">view page</Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Dismissed */}
      {dismissed.length > 0 && (
        <details>
          <summary className="text-sm font-semibold text-slate-500 cursor-pointer">Dismissed ({dismissed.length})</summary>
          <ul className="space-y-1 mt-2">
            {dismissed.map((q) => (
              <li key={q.id} className="flex items-center gap-3 text-sm text-slate-400 px-3 py-1.5">
                <span className="flex-1 line-through">{q.question}</span>
                <button onClick={() => setStatus(q.id, 'open')} disabled={busy !== null} className="text-xs text-indigo-600 hover:underline disabled:opacity-50">Restore</button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
