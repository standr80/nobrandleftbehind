'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Member {
  id: string
  tenant_id: string
  name: string | null
  email: string | null
  role: string
  clerk_user_id: string
  created_at: string | null
}

interface Props {
  workspaceId: string
  workspaceName: string
  members: Member[]
}

const ROLES = ['admin', 'author', 'reviewer'] as const

export default function WorkspaceManage({ workspaceId, workspaceName, members: initialMembers }: Props) {
  const [open, setOpen] = useState(false)
  const [members, setMembers] = useState<Member[]>(initialMembers)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function changeRole(memberId: string, newRole: string) {
    setUpdatingId(memberId)
    setError('')
    try {
      const res = await fetch(`/api/admin/workspaces/${workspaceId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to update role')
      setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, role: newRole } : m))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role')
    } finally {
      setUpdatingId(null)
    }
  }

  async function removeMember(memberId: string) {
    if (!confirm('Remove this member from the workspace?')) return
    setRemovingId(memberId)
    setError('')
    try {
      const res = await fetch(`/api/admin/workspaces/${workspaceId}/members/${memberId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to remove member')
      setMembers((prev) => prev.filter((m) => m.id !== memberId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member')
    } finally {
      setRemovingId(null)
    }
  }

  async function deleteWorkspace() {
    if (!confirm(`Delete workspace "${workspaceName}"?\n\nThis will permanently delete all posts, suggestions, and members. This cannot be undone.`)) return
    setDeleting(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/workspaces/${workspaceId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to delete workspace')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete workspace')
      setDeleting(false)
    }
  }

  return (
    <div className="border-t border-white/5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-2.5 text-xs text-white/30 hover:text-white/60 hover:bg-white/3 transition-colors"
      >
        <span>{open ? 'Hide' : 'Manage'} workspace</span>
        <svg
          className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-6 pb-5 space-y-4">
          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Members */}
          <div>
            <p className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-2">Members</p>
            {members.length === 0 ? (
              <p className="text-xs text-white/20 italic">No members yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate">{m.name ?? m.email ?? m.clerk_user_id}</p>
                      {m.email && m.name && (
                        <p className="text-xs text-white/30 truncate">{m.email}</p>
                      )}
                    </div>

                    {/* Role selector */}
                    <div className="flex gap-1 shrink-0">
                      {ROLES.map((r) => (
                        <button
                          key={r}
                          disabled={updatingId === m.id}
                          onClick={() => m.role !== r && changeRole(m.id, r)}
                          className={`px-2.5 py-1 text-xs rounded-lg capitalize transition-colors ${
                            m.role === r
                              ? r === 'admin'
                                ? 'bg-indigo-600 text-white'
                                : r === 'reviewer'
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-white/20 text-white'
                              : 'text-white/30 hover:text-white/60'
                          } disabled:opacity-40`}
                        >
                          {updatingId === m.id && m.role !== r ? '…' : r}
                        </button>
                      ))}
                    </div>

                    {/* Remove */}
                    <button
                      onClick={() => removeMember(m.id)}
                      disabled={removingId === m.id}
                      className="text-white/20 hover:text-red-400 transition-colors text-sm disabled:opacity-30 shrink-0"
                      title="Remove member"
                    >
                      {removingId === m.id ? '…' : '✕'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Danger zone */}
          <div className="border border-red-500/20 bg-red-500/5 rounded-xl p-4">
            <p className="text-xs font-semibold text-red-400 mb-1">Danger zone</p>
            <p className="text-xs text-white/40 mb-3">
              Permanently delete this workspace, all its posts, suggestions, and member access. Cannot be undone.
            </p>
            <button
              onClick={deleteWorkspace}
              disabled={deleting}
              className="px-4 py-1.5 text-xs bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 text-red-300 rounded-lg transition-colors disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : `Delete "${workspaceName}"`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
