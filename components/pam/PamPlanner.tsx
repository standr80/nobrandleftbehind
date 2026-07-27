'use client'

import { useMemo, useState } from 'react'

export interface PlannerPost {
  id: string
  title: string
  content_type: string
  status: string | null
  published_at: string | null
  scheduled_for: string | null
}

export interface PamItem {
  id: string
  kind: string
  item_type: string
  title: string
  note: string | null
  reason: string | null
  status: string
  scheduled_for: string | null
  snoozed_until: string | null
  source: string
  target_post_id: string | null
  suggestion_id: string | null
  created_at: string | null
}

interface Props {
  tenantId: string
  initialPosts: PlannerPost[]
  initialItems: PamItem[]
}

const TYPE_OPTIONS = ['post', 'faq', 'gallery', 'refresh', 'other'] as const

const TYPE_BADGE: Record<string, string> = {
  post: 'bg-indigo-100 text-indigo-700',
  faq: 'bg-sky-100 text-sky-700',
  gallery: 'bg-amber-100 text-amber-700',
  refresh: 'bg-violet-100 text-violet-700',
  other: 'bg-slate-100 text-slate-600',
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function PamPlanner({ tenantId, initialPosts, initialItems }: Props) {
  const [items, setItems] = useState<PamItem[]>(initialItems)
  const [monthStart, setMonthStart] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [ideaText, setIdeaText] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  // ── Calendar data ─────────────────────────────────────────────────────────
  const byDay = useMemo(() => {
    const map: Record<string, { published: PlannerPost[]; scheduled: PlannerPost[]; pam: PamItem[] }> = {}
    const ensure = (k: string) => (map[k] ??= { published: [], scheduled: [], pam: [] })
    for (const p of initialPosts) {
      if (p.published_at) ensure(p.published_at.slice(0, 10)).published.push(p)
      else if (p.scheduled_for) ensure(p.scheduled_for.slice(0, 10)).scheduled.push(p)
    }
    for (const i of items) {
      if (i.scheduled_for) ensure(i.scheduled_for.slice(0, 10)).pam.push(i)
    }
    return map
  }, [initialPosts, items])

  const weeks = useMemo(() => {
    const first = new Date(monthStart)
    // Monday-start grid
    const lead = (first.getDay() + 6) % 7
    const start = new Date(first)
    start.setDate(first.getDate() - lead)
    const out: Date[][] = []
    const cursor = new Date(start)
    do {
      const week: Date[] = []
      for (let i = 0; i < 7; i++) {
        week.push(new Date(cursor))
        cursor.setDate(cursor.getDate() + 1)
      }
      out.push(week)
    } while (cursor.getMonth() === monthStart.getMonth())
    return out
  }, [monthStart])

  const todayKey = dayKey(new Date())
  const monthLabel = monthStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  // ── Item mutations ────────────────────────────────────────────────────────
  async function addIdea(e: React.FormEvent) {
    e.preventDefault()
    if (!ideaText.trim() || adding) return
    setAdding(true)
    setError(null)
    try {
      const res = await fetch('/api/pam/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, title: ideaText.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not save idea')
      setItems((xs) => [data.item, ...xs])
      setIdeaText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save idea')
    } finally {
      setAdding(false)
    }
  }

  async function patchItem(id: string, patch: Record<string, unknown>) {
    if (busyId) return
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch(`/api/pam/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, ...patch }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.item) setItems((xs) => xs.map((x) => (x.id === id ? data.item : x)))
      else setError(data.error ?? 'Could not save the change — try again')
    } catch {
      setError('Could not save the change — try again')
    } finally {
      setBusyId(null)
    }
  }

  async function deleteItem(id: string) {
    if (busyId) return
    setBusyId(id)
    try {
      const res = await fetch(`/api/pam/items/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      })
      if (res.ok) setItems((xs) => xs.filter((x) => x.id !== id))
    } finally {
      setBusyId(null)
    }
  }

  const backlog = items.filter((i) => i.kind === 'idea' && (i.status === 'open' || i.status === 'scheduled'))
  const doneIdeas = items.filter((i) => i.kind === 'idea' && i.status === 'done')
  const recommendations = items.filter((i) => i.kind === 'recommendation' && i.status !== 'done')

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      {/* ── Calendar ── */}
      <div className="xl:col-span-2 bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-900">{monthLabel}</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMonthStart((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              className="px-2 py-1 rounded-lg text-slate-500 hover:bg-slate-100"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => { const d = new Date(); setMonthStart(new Date(d.getFullYear(), d.getMonth(), 1)) }}
              className="px-2 py-1 rounded-lg text-xs text-slate-500 hover:bg-slate-100"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setMonthStart((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              className="px-2 py-1 rounded-lg text-slate-500 hover:bg-slate-100"
            >
              →
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 text-[11px] text-slate-400 font-medium mb-1">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="px-1.5">{d}</div>
          ))}
        </div>
        <div className="space-y-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1">
              {week.map((day) => {
                const k = dayKey(day)
                const inMonth = day.getMonth() === monthStart.getMonth()
                const cell = byDay[k]
                return (
                  <div
                    key={k}
                    className={`min-h-[72px] rounded-lg border p-1.5 text-[11px] ${
                      k === todayKey
                        ? 'border-rose-400 bg-rose-50/50'
                        : inMonth
                          ? 'border-slate-200 bg-white'
                          : 'border-slate-100 bg-slate-50 text-slate-300'
                    }`}
                  >
                    <div className={`font-medium ${inMonth ? 'text-slate-500' : ''}`}>{day.getDate()}</div>
                    {cell?.published.map((p) => (
                      <div key={p.id} className="truncate text-indigo-700" title={`Published: ${p.title}`}>
                        ● {p.title}
                      </div>
                    ))}
                    {cell?.scheduled.map((p) => (
                      <div key={p.id} className="truncate text-sky-600" title={`Scheduled: ${p.title}`}>
                        ○ {p.title}
                      </div>
                    ))}
                    {cell?.pam.map((i) => (
                      <div
                        key={i.id}
                        className={`truncate ${i.status === 'done' ? 'text-slate-400 line-through' : 'text-rose-600'}`}
                        title={`${i.item_type}: ${i.title}${i.status === 'done' ? ' (done)' : ''}`}
                      >
                        {i.status === 'done' ? '✓' : '◆'} {i.title}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          <span className="text-indigo-700">●</span> published ·{' '}
          <span className="text-sky-600">○</span> scheduled post ·{' '}
          <span className="text-rose-600">◆</span> planned item
        </p>
      </div>

      {/* ── Right column: desk + ideas ── */}
      <div className="space-y-4">
        {/* Pam's desk */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Pam&apos;s desk</h2>
          {recommendations.length === 0 ? (
            <p className="text-xs text-slate-400">
              No recommendations yet — Pam&apos;s engine arrives in the next stage. Your ideas below
              already work.
            </p>
          ) : (
            <ul className="space-y-2">
              {recommendations.map((r) => (
                <li key={r.id} className="border border-slate-200 rounded-lg p-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${TYPE_BADGE[r.item_type]}`}>
                      {r.item_type}
                    </span>
                    <span className="text-sm text-slate-800">{r.title}</span>
                  </div>
                  {r.reason && <p className="text-xs text-slate-500 mt-1">{r.reason}</p>}
                  <div className="flex items-center gap-3 mt-2 text-xs">
                    <button
                      type="button"
                      onClick={() => void patchItem(r.id, { status: 'dismissed' })}
                      className="text-slate-400 hover:text-red-600"
                    >
                      Dismiss
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Ideas */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-2">Ideas</h2>
          <form onSubmit={addIdea} className="flex gap-2 mb-3">
            <input
              type="text"
              value={ideaText}
              onChange={(e) => setIdeaText(e.target.value)}
              placeholder="Jot an idea — that's all it takes"
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <button
              type="submit"
              disabled={adding || !ideaText.trim()}
              className="px-3 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 disabled:opacity-50"
            >
              {adding ? '…' : 'Add'}
            </button>
          </form>
          {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
          {backlog.length === 0 ? (
            <p className="text-xs text-slate-400">No ideas yet — anything you jot here is per-workspace.</p>
          ) : (
            <ul className="space-y-2">
              {backlog.map((i) => (
                <li key={i.id} className="border border-slate-200 rounded-lg p-2.5">
                  <p className="text-sm text-slate-800">{i.title}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <select
                      value={i.item_type}
                      onChange={(e) => void patchItem(i.id, { item_type: e.target.value })}
                      disabled={busyId === i.id}
                      className="text-xs border border-slate-300 rounded-md px-1.5 py-1 text-slate-600"
                    >
                      {TYPE_OPTIONS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={i.scheduled_for ?? ''}
                      onChange={(e) => void patchItem(i.id, { scheduled_for: e.target.value || null })}
                      disabled={busyId === i.id}
                      className="text-xs border border-slate-300 rounded-md px-1.5 py-1 text-slate-600"
                    />
                    <button
                      type="button"
                      onClick={() => void patchItem(i.id, { status: 'done' })}
                      disabled={busyId === i.id}
                      className="text-xs text-emerald-600 hover:underline ml-auto"
                    >
                      Done
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteItem(i.id)}
                      disabled={busyId === i.id}
                      className="text-xs text-slate-400 hover:text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Completed ideas stay visible — a planner ticks things off, it
              doesn't disappear them. */}
          {doneIdeas.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-400 mb-1.5">Done</p>
              <ul className="space-y-1.5">
                {doneIdeas.map((i) => (
                  <li key={i.id} className="flex items-center gap-2 text-sm">
                    <span className="text-emerald-600">✓</span>
                    <span className="text-slate-400 line-through truncate flex-1">{i.title}</span>
                    {i.scheduled_for && (
                      <span className="text-[11px] text-slate-300 shrink-0">{i.scheduled_for}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => void patchItem(i.id, { status: i.scheduled_for ? 'scheduled' : 'open' })}
                      disabled={busyId === i.id}
                      className="text-xs text-slate-400 hover:text-slate-700 shrink-0"
                    >
                      Reopen
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
