'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface GallerySummary {
  id: string
  title: string
  status: string | null
  context: string | null
  imageCount: number
  readyCount: number
  failedCount: number
  created_at: string | null
  displayOrder: number | null
  eventDate: string | null
  featured: boolean
}

interface Props {
  initialGalleries: GallerySummary[]
  tenantId: string
}

export default function BaileyGalleries({ initialGalleries, tenantId }: Props) {
  const router = useRouter()
  const [galleries, setGalleries] = useState(initialGalleries)
  const [title, setTitle] = useState('')
  const [context, setContext] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)

  /**
   * Move a gallery one place up or down and persist the whole order.
   *
   * The list is reordered locally first so the row moves under the cursor
   * immediately; a failed save puts it back rather than leaving the screen
   * disagreeing with the database.
   */
  async function move(index: number, delta: number) {
    const target = index + delta
    if (reordering || target < 0 || target >= galleries.length) return

    const previous = galleries
    const next = [...galleries]
    ;[next[index], next[target]] = [next[target], next[index]]
    setGalleries(next)
    setReordering(true)
    setError(null)
    try {
      const res = await fetch('/api/galleries/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, ids: next.map((g) => g.id) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not save the new order')
    } catch (err) {
      setGalleries(previous)
      setError(err instanceof Error ? err.message : 'Could not save the new order')
    } finally {
      setReordering(false)
    }
  }

  async function createGallery(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || creating) return
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/galleries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, title: title.trim(), context: context.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not create gallery')
      router.push(`/dashboard/bailey/${data.gallery.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create gallery')
      setCreating(false)
    }
  }

  async function deleteGallery(id: string) {
    if (deletingId) return
    if (!window.confirm('Delete this gallery? Its images will no longer be listed.')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/galleries/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      })
      if (res.ok) setGalleries((gs) => gs.filter((g) => g.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Create */}
      <form onSubmit={createGallery} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">New gallery</h2>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Gallery title — e.g. Crazy golf at a Kent wedding"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        <input
          type="text"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Optional context — venue, occasion, location (this makes captions much better)"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={creating || !title.trim()}
          className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
        >
          {creating ? 'Creating…' : 'Create gallery'}
        </button>
      </form>

      {/* List */}
      {galleries.length === 0 ? (
        <p className="text-sm text-slate-400">No galleries yet — create your first one above.</p>
      ) : (
        <ul className="space-y-2">
          {galleries.map((g, i) => (
            <li
              key={g.id}
              className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-4 hover:border-amber-300 transition-colors cursor-pointer"
              onClick={() => router.push(`/dashboard/bailey/${g.id}`)}
            >
              <div
                className="flex flex-col shrink-0 -my-1"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => void move(i, -1)}
                  disabled={i === 0 || reordering}
                  aria-label={`Move ${g.title} up`}
                  className="w-6 h-5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-25 disabled:hover:bg-transparent text-[11px] leading-none"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => void move(i, 1)}
                  disabled={i === galleries.length - 1 || reordering}
                  aria-label={`Move ${g.title} down`}
                  className="w-6 h-5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-25 disabled:hover:bg-transparent text-[11px] leading-none"
                >
                  ▼
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {g.title}
                  {g.featured && (
                    <span
                      title="Featured — consumer sites lead with this gallery"
                      className="ml-2 text-amber-600"
                    >
                      ★
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {g.imageCount} image{g.imageCount === 1 ? '' : 's'}
                  {g.failedCount > 0 && <span className="text-red-600"> · {g.failedCount} failed</span>}
                  {g.eventDate && (
                    <span>
                      {' '}
                      ·{' '}
                      {new Date(g.eventDate).toLocaleDateString('en-GB', {
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  )}
                  {g.context && <span> · {g.context}</span>}
                </p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600 capitalize shrink-0">
                {g.status ?? 'draft'}
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); void deleteGallery(g.id) }}
                disabled={deletingId === g.id}
                className="text-xs text-slate-400 hover:text-red-600 disabled:opacity-50 shrink-0"
              >
                {deletingId === g.id ? 'Deleting…' : 'Delete'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
