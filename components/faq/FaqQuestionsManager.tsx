'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export interface FaqQuestion {
  id: string
  question: string
  answer?: string | null
  source: string | null
  topic: string | null
  status: string | null
  used_in_post_id: string | null
  created_at: string | null
}

interface Topic {
  id: string
  name: string
  status: string | null
  generated_post_id: string | null
  questionCount: number
}

interface Props {
  initialQuestions: FaqQuestion[]
  tenantId: string
}

export default function FaqQuestionsManager({ initialQuestions, tenantId }: Props) {
  const [topics, setTopics] = useState<Topic[]>([])
  const [pool, setPool] = useState<FaqQuestion[]>(initialQuestions)
  const [openTopicId, setOpenTopicId] = useState<string | null>(null)
  const [topicQuestions, setTopicQuestions] = useState<FaqQuestion[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [newTopicName, setNewTopicName] = useState('')
  const [newQ, setNewQ] = useState('')
  const [newA, setNewA] = useState('')
  const [assignTarget, setAssignTarget] = useState('')

  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generatedPostId, setGeneratedPostId] = useState<string | null>(null)

  const openTopic = topics.find((t) => t.id === openTopicId) ?? null
  const openPool = pool.filter((q) => q.status === 'open')

  // ── Loaders ───────────────────────────────────────────────────────────────
  async function refreshTopics() {
    const res = await fetch('/api/faq/topics')
    if (res.ok) setTopics((await res.json()).topics ?? [])
  }
  async function refreshPool() {
    const res = await fetch('/api/faq/questions')
    if (res.ok) setPool((await res.json()).questions ?? [])
  }
  async function loadTopicQuestions(id: string) {
    const res = await fetch(`/api/faq/topics/${id}/questions`)
    setTopicQuestions(res.ok ? (await res.json()).questions ?? [] : [])
  }

  useEffect(() => {
    refreshTopics()
  }, [])

  useEffect(() => {
    if (openTopicId) loadTopicQuestions(openTopicId)
    else setTopicQuestions([])
  }, [openTopicId])

  async function reloadOpen() {
    await Promise.all([refreshTopics(), refreshPool(), openTopicId ? loadTopicQuestions(openTopicId) : Promise.resolve()])
  }

  function fail(msg: string) { setError(msg) }

  // ── Topic actions ───────────────────────────────────────────────────────────
  async function createTopic() {
    const name = newTopicName.trim()
    if (!name) return
    setBusy('createTopic'); setError(null)
    try {
      const res = await fetch('/api/faq/topics', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, name }),
      })
      const data = await res.json()
      if (!res.ok) return fail(data.error ?? 'Failed to create topic')
      setNewTopicName('')
      await refreshTopics()
      setOpenTopicId(data.topic?.id ?? null)
    } catch { fail('Network error') } finally { setBusy(null) }
  }

  async function deleteTopic(id: string) {
    setBusy('t-' + id); setError(null)
    try {
      const res = await fetch(`/api/faq/topics/${id}`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      })
      if (!res.ok) return fail((await res.json()).error ?? 'Delete failed')
      if (openTopicId === id) setOpenTopicId(null)
      await refreshTopics()
    } catch { fail('Network error') } finally { setBusy(null) }
  }

  async function assign(topicId: string, questionIds: string[]) {
    if (!questionIds.length) return
    setBusy('assign'); setError(null)
    try {
      const res = await fetch(`/api/faq/topics/${topicId}/questions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, questionIds }),
      })
      if (!res.ok) return fail((await res.json()).error ?? 'Assign failed')
      setSelected(new Set())
      await reloadOpen()
    } catch { fail('Network error') } finally { setBusy(null) }
  }

  async function unassign(topicId: string, questionId: string) {
    setBusy('u-' + questionId); setError(null)
    try {
      const res = await fetch(`/api/faq/topics/${topicId}/questions`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, questionId }),
      })
      if (!res.ok) return fail((await res.json()).error ?? 'Remove failed')
      await Promise.all([refreshTopics(), loadTopicQuestions(topicId)])
    } catch { fail('Network error') } finally { setBusy(null) }
  }

  async function suggestForTopic() {
    if (!openTopic) return
    setBusy('suggest'); setError(null)
    try {
      const res = await fetch('/api/clem/faq/suggest-questions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, topic: openTopic.name, topicId: openTopic.id }),
      })
      const data = await res.json()
      if (!res.ok) return fail(data.error ?? 'Suggest failed')
      if (!data.added) fail('No new questions suggested — try a different angle.')
      await reloadOpen()
    } catch { fail('Network error') } finally { setBusy(null) }
  }

  async function addQnaToTopic() {
    if (!openTopic || newQ.trim().length < 4) return
    setBusy('addqna'); setError(null)
    try {
      const res = await fetch('/api/faq/questions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, question: newQ.trim(), answer: newA.trim() || null, topicId: openTopic.id }),
      })
      if (!res.ok) return fail((await res.json()).error ?? 'Add failed')
      setNewQ(''); setNewA('')
      await reloadOpen()
    } catch { fail('Network error') } finally { setBusy(null) }
  }

  async function generatePage(topicId: string) {
    setBusy('generate'); setError(null); setGeneratedPostId(null)
    try {
      const res = await fetch('/api/clem/faq', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, topicId }),
      })
      const data = await res.json()
      if (!res.ok) return fail(data.error ?? 'Generation failed')
      setGeneratedPostId(data.postId)
      await reloadOpen()
    } catch { fail('Network error') } finally { setBusy(null) }
  }

  // ── Pool actions ─────────────────────────────────────────────────────────────
  async function importPaa() {
    setBusy('import'); setError(null)
    try {
      const res = await fetch('/api/faq/questions/import-paa', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      })
      if (!res.ok) return fail((await res.json()).error ?? 'Import failed')
      await refreshPool()
    } catch { fail('Network error') } finally { setBusy(null) }
  }

  async function addToPool() {
    if (newQ.trim().length < 4) return
    setBusy('addpool'); setError(null)
    try {
      const res = await fetch('/api/faq/questions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, question: newQ.trim(), answer: newA.trim() || null }),
      })
      if (!res.ok) return fail((await res.json()).error ?? 'Add failed')
      setNewQ(''); setNewA('')
      await refreshPool()
    } catch { fail('Network error') } finally { setBusy(null) }
  }

  async function dismiss(id: string) {
    setBusy('d-' + id)
    try {
      await fetch(`/api/faq/questions/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, status: 'dismissed' }),
      })
      setSelected((s) => { const n = new Set(s); n.delete(id); return n })
      await refreshPool()
    } finally { setBusy(null) }
  }

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const sourceBadge = (s: string | null) => {
    const label = s === 'scout_paa' ? 'SCOUT' : s === 'clem' ? 'CLEM' : 'MANUAL'
    const cls = s === 'scout_paa' ? 'text-emerald-700 bg-emerald-100' : s === 'clem' ? 'text-indigo-700 bg-indigo-100' : 'text-slate-500 bg-slate-100'
    return <span className={`text-[10px] font-semibold rounded px-1.5 py-0.5 ${cls}`}>{label}</span>
  }
  const btn = 'text-sm font-medium px-3 py-2 rounded-lg disabled:opacity-50'
  const input = 'text-sm border border-slate-300 rounded-lg px-3 py-2'

  return (
    <div className="space-y-8">
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
      {generatedPostId && (
        <div className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          FAQ page drafted.{' '}
          <Link href={`/author/${generatedPostId}`} className="font-medium underline">Open it in the editor →</Link>
        </div>
      )}

      {/* ── TOPICS ── */}
      <section>
        <h2 className="text-sm font-semibold text-slate-900 mb-3">FAQ topics</h2>
        <div className="flex gap-2 mb-4">
          <input
            value={newTopicName}
            onChange={(e) => setNewTopicName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createTopic()}
            placeholder="New FAQ topic (e.g. Giant cheque sizes)"
            className={`flex-1 ${input}`}
          />
          <button onClick={createTopic} disabled={busy !== null || !newTopicName.trim()} className={`${btn} bg-slate-900 text-white hover:bg-slate-700`}>
            {busy === 'createTopic' ? 'Creating…' : 'Create FAQ topic'}
          </button>
        </div>

        {topics.length === 0 ? (
          <p className="text-sm text-slate-400">No topics yet. Create one to start building an FAQ page.</p>
        ) : (
          <ul className="space-y-2">
            {topics.map((t) => (
              <li key={t.id} className="border border-slate-200 rounded-xl">
                <div className="flex items-center gap-3 px-4 py-3">
                  <button onClick={() => setOpenTopicId(openTopicId === t.id ? null : t.id)} className="flex-1 text-left">
                    <span className="text-sm font-medium text-slate-900">{t.name}</span>
                    <span className="text-xs text-slate-400 ml-2">{t.questionCount} question{t.questionCount === 1 ? '' : 's'}</span>
                  </button>
                  {t.status === 'generated' && t.generated_post_id ? (
                    <Link href={`/author/${t.generated_post_id}`} className="text-xs font-semibold text-emerald-700 bg-emerald-100 rounded px-1.5 py-0.5">GENERATED · view</Link>
                  ) : (
                    <span className="text-xs font-semibold text-amber-700 bg-amber-100 rounded px-1.5 py-0.5">DRAFT</span>
                  )}
                  <button onClick={() => deleteTopic(t.id)} disabled={busy !== null} className="text-xs text-slate-400 hover:text-red-600">Delete</button>
                </div>

                {openTopicId === t.id && (
                  <div className="border-t border-slate-100 px-4 py-3 space-y-3">
                    {/* Assigned questions */}
                    {topicQuestions.length === 0 ? (
                      <p className="text-xs text-slate-400">No questions assigned yet. Suggest, add, or assign from the pool below.</p>
                    ) : (
                      <ul className="space-y-1">
                        {topicQuestions.map((q) => (
                          <li key={q.id} className="flex items-start gap-2 text-sm text-slate-800">
                            <span className="flex-1">{q.question}{q.answer ? <span className="text-xs text-emerald-600 ml-1">✓ answered</span> : null}</span>
                            <button onClick={() => unassign(t.id, q.id)} disabled={busy !== null} className="text-xs text-slate-400 hover:text-red-600">remove</button>
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Topic-scoped actions */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button onClick={suggestForTopic} disabled={busy !== null} className={`${btn} border border-indigo-300 text-indigo-700 hover:bg-indigo-50`}>
                        {busy === 'suggest' ? 'Suggesting…' : 'Suggest questions'}
                      </button>
                      <button onClick={() => generatePage(t.id)} disabled={busy !== null} className={`${btn} bg-indigo-600 text-white hover:bg-indigo-700`}>
                        {busy === 'generate' ? 'Generating…' : 'Generate FAQ page'}
                      </button>
                    </div>

                    {/* Manual add Q + optional A */}
                    <div className="space-y-2 pt-1">
                      <input value={newQ} onChange={(e) => setNewQ(e.target.value)} placeholder="Add a question…" className={`w-full ${input}`} />
                      <textarea value={newA} onChange={(e) => setNewA(e.target.value)} placeholder="Optional answer (used verbatim if provided)…" rows={2} className={`w-full ${input}`} />
                      <button onClick={addQnaToTopic} disabled={busy !== null || newQ.trim().length < 4} className={`${btn} border border-slate-300 text-slate-700 hover:bg-slate-50`}>
                        {busy === 'addqna' ? 'Adding…' : 'Add to topic'}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── QUESTION POOL ── */}
      <section>
        <h2 className="text-sm font-semibold text-slate-900 mb-1">Question pool</h2>
        <p className="text-xs text-slate-400 mb-3">Unassigned questions. Import from Scout or add your own, then assign to a topic above.</p>

        <div className="flex flex-wrap gap-2 mb-3">
          <button onClick={importPaa} disabled={busy !== null} className={`${btn} border border-emerald-300 text-emerald-700 hover:bg-emerald-50`}>
            {busy === 'import' ? 'Importing…' : 'Import from Scout (PAA)'}
          </button>
        </div>
        <div className="flex gap-2 mb-4">
          <input value={newQ} onChange={(e) => setNewQ(e.target.value)} placeholder="Add a question to the pool…" className={`flex-1 ${input}`} />
          <button onClick={addToPool} disabled={busy !== null || newQ.trim().length < 4} className={`${btn} bg-slate-900 text-white hover:bg-slate-700`}>
            {busy === 'addpool' ? 'Adding…' : 'Add'}
          </button>
        </div>

        {/* Bulk assign */}
        {selected.size > 0 && topics.length > 0 && (
          <div className="flex items-center gap-2 mb-3 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
            <span className="text-sm text-slate-600">{selected.size} selected →</span>
            <select value={assignTarget} onChange={(e) => setAssignTarget(e.target.value)} className={input}>
              <option value="">Choose a topic…</option>
              {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button onClick={() => assignTarget && assign(assignTarget, Array.from(selected))} disabled={busy !== null || !assignTarget} className={`${btn} bg-indigo-600 text-white hover:bg-indigo-700`}>
              Assign
            </button>
          </div>
        )}

        {openPool.length === 0 ? (
          <p className="text-sm text-slate-400">Pool is empty.</p>
        ) : (
          <ul className="space-y-1">
            {openPool.map((q) => (
              <li key={q.id} className="flex items-start gap-3 border border-slate-200 rounded-lg px-3 py-2">
                <input type="checkbox" checked={selected.has(q.id)} onChange={() => toggle(q.id)} className="mt-1" />
                <span className="flex-1 text-sm text-slate-800">{q.question}{q.answer ? <span className="text-xs text-emerald-600 ml-1">✓ answered</span> : null}</span>
                {sourceBadge(q.source)}
                <button onClick={() => dismiss(q.id)} disabled={busy !== null} className="text-xs text-slate-400 hover:text-red-600">Dismiss</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
