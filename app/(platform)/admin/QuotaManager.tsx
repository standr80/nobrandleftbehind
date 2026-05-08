'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Quota {
  id: string
  clerk_user_id: string
  max_workspaces: number
  notes: string | null
  email?: string | null
  name?: string | null
}

interface Props {
  quotas: Quota[]
}

export default function QuotaManager({ quotas: initialQuotas }: Props) {
  const [quotas, setQuotas] = useState<Quota[]>(initialQuotas)
  const [email, setEmail] = useState('')
  const [maxWorkspaces, setMaxWorkspaces] = useState(1)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState(1)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()

  async function grant() {
    if (!email.trim()) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/admin/quotas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), max_workspaces: maxWorkspaces, notes: notes.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to grant quota')
      setSuccess(`Quota granted — ${email} can now create up to ${maxWorkspaces} workspace${maxWorkspaces !== 1 ? 's' : ''}.`)
      setEmail('')
      setNotes('')
      setMaxWorkspaces(1)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to grant quota')
    } finally {
      setSaving(false)
    }
  }

  async function updateQuota(q: Quota, newMax: number) {
    setUpdatingId(q.clerk_user_id)
    setError('')
    try {
      const res = await fetch('/api/admin/quotas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: q.email ?? q.clerk_user_id,
          max_workspaces: newMax,
          notes: q.notes,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to update')
      setQuotas((prev) => prev.map((item) =>
        item.clerk_user_id === q.clerk_user_id ? { ...item, max_workspaces: newMax } : item
      ))
      setEditingId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update quota')
    } finally {
      setUpdatingId(null)
    }
  }

  async function revoke(clerkUserId: string) {
    if (!confirm('Revoke this user\'s workspace creation access?')) return
    setRevoking(clerkUserId)
    setError('')
    try {
      const res = await fetch('/api/admin/quotas', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clerkUserId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to revoke')
      setQuotas((prev) => prev.filter((q) => q.clerk_user_id !== clerkUserId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke quota')
    } finally {
      setRevoking(null)
    }
  }

  const inputClass = 'bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 transition-colors'

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden mb-8">
      <div className="px-6 py-4 border-b border-white/10">
        <h2 className="text-sm font-medium text-white/70">Workspace creation access</h2>
        <p className="text-xs text-white/30 mt-0.5">
          Grant specific users the ability to create their own workspaces via /setup.
          By default, new users cannot create workspaces.
        </p>
      </div>

      {/* Grant form */}
      <div className="px-6 py-4 border-b border-white/10 space-y-3">
        <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Grant access</p>
        <div className="flex gap-3 flex-wrap">
          <input
            type="email"
            className={`${inputClass} flex-1 min-w-[220px]`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && grant()}
            placeholder="user@theirdomain.com"
          />
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-xs text-white/40">Max workspaces</label>
            <input
              type="number"
              min={1}
              max={50}
              className={`${inputClass} w-20 text-center`}
              value={maxWorkspaces}
              onChange={(e) => setMaxWorkspaces(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>
          <input
            className={`${inputClass} flex-1 min-w-[160px]`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
          />
          <button
            onClick={grant}
            disabled={saving || !email.trim()}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm rounded-lg transition-colors shrink-0"
          >
            {saving ? 'Granting…' : 'Grant'}
          </button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {success && <p className="text-xs text-emerald-400">{success}</p>}
      </div>

      {/* Existing quotas */}
      {quotas.length === 0 ? (
        <div className="px-6 py-8 text-center">
          <p className="text-sm text-white/20">No workspace creation access granted yet.</p>
        </div>
      ) : (
        <ul className="divide-y divide-white/5">
          {quotas.map((q) => (
            <li key={q.id} className="flex items-center justify-between px-6 py-3.5 gap-4">
              <div className="min-w-0">
                <p className="text-sm text-white truncate">{q.email ?? q.clerk_user_id}</p>
                {q.name && <p className="text-xs text-white/30 truncate">{q.name}</p>}
                {q.notes && <p className="text-xs text-white/20 italic truncate">{q.notes}</p>}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {editingId === q.clerk_user_id ? (
                  <>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(Math.max(1, parseInt(e.target.value) || 1))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') updateQuota(q, editValue)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      className="w-16 text-center bg-white/10 border border-indigo-500 rounded-lg px-2 py-1 text-sm text-white focus:outline-none"
                    />
                    <button
                      onClick={() => updateQuota(q, editValue)}
                      disabled={updatingId === q.clerk_user_id}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-40"
                    >
                      {updatingId === q.clerk_user_id ? '…' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-xs text-white/30 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => { setEditingId(q.clerk_user_id); setEditValue(q.max_workspaces) }}
                      className="text-xs text-white/50 hover:text-white transition-colors tabular-nums"
                      title="Click to edit"
                    >
                      up to <strong className="text-white">{q.max_workspaces}</strong> workspace{q.max_workspaces !== 1 ? 's' : ''} ✎
                    </button>
                    <button
                      onClick={() => revoke(q.clerk_user_id)}
                      disabled={revoking === q.clerk_user_id}
                      className="text-xs text-white/20 hover:text-red-400 transition-colors disabled:opacity-30"
                      title="Revoke access"
                    >
                      {revoking === q.clerk_user_id ? '…' : 'Revoke'}
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
