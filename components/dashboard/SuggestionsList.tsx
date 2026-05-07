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

export default function SuggestionsList({ suggestions, tenantId }: Props) {
  const router = useRouter()
  const [drafting, setDrafting] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pending = suggestions.filter((s) => s.status === 'pending')

  if (!pending.length) return null

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
      const res = await fetch('/api/suggestions/' + suggestionId, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to reject')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setRejecting(null)
    }
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-white/10">
        <h2 className="text-sm font-medium text-white/70">
          Pending suggestions
          <span className="ml-2 text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full">
            {pending.length}
          </span>
        </h2>
      </div>

      <ul className="divide-y divide-white/5">
        {pending.map((s) => (
          <li key={s.id} className="px-6 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">{s.proposed_title}</p>
                {s.rationale && (
                  <p className="text-xs text-white/40 mt-1 line-clamp-2">{s.rationale}</p>
                )}
                {s.target_keywords?.length ? (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {s.target_keywords.map((kw) => (
                      <span key={kw} className="text-xs bg-white/5 text-white/40 px-2 py-0.5 rounded">
                        {kw}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleReject(s.id)}
                  disabled={drafting === s.id || rejecting === s.id}
                  className="px-3 py-1.5 text-xs text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-30"
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
          </li>
        ))}
      </ul>

      {error && (
        <div className="px-6 py-3 border-t border-white/10">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}
    </div>
  )
}
