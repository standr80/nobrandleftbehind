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

export default function WorkspaceManage({ workspaceId, workspaceName, members: initialMembers }: Props) {
  const [open, setOpen] = useState(false)
  const [members, setMembers] = useState<Member[]>(initialMembers)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  // Add admin form
  const [showAddAdmin, setShowAddAdmin] = useState(false)
  const [adminEmail, setAdminEmail] = useState('')
  const [addingAdmin, setAddingAdmin] = useState(false)
  const [addAdminResult, setAddAdminResult] = useState<{ inviteUrl?: string; direct?: boolean } | null>(null)

  const router = useRouter()

  const admins = members.filter((m) => m.role === 'admin')

  async function removeAdmin(memberId: string) {
    if (admins.length <= 1) {
      setError('Cannot remove the last admin of a workspace.')
      return
    }
    if (!confirm('Remove this admin from the workspace?')) return
    setRemovingId(memberId)
    setError('')
    try {
      const res = await fetch(`/api/admin/workspaces/${workspaceId}/members/${memberId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to remove admin')
      setMembers((prev) => prev.filter((m) => m.id !== memberId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove admin')
    } finally {
      setRemovingId(null)
    }
  }

  async function addAdmin() {
    if (!adminEmail.trim()) return
    setAddingAdmin(true)
    setError('')
    setAddAdminResult(null)
    try {
      const res = await fetch(`/api/admin/workspaces/${workspaceId}/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to add admin')

      if (data.invited) {
        setAddAdminResult({ inviteUrl: data.inviteUrl })
      } else {
        setAddAdminResult({ direct: true })
        // Add the new member to local state so it appears immediately
        if (data.member) setMembers((prev) => [...prev, data.member])
      }
      setAdminEmail('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add admin')
    } finally {
      setAddingAdmin(false)
    }
  }

  async function deleteWorkspace() {
    if (!confirm(`Delete workspace "${workspaceName}"?\n\nThis will permanently delete all posts, suggestions, and member access. This cannot be undone.`)) return
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
        className="w-full flex items-center justify-between px-6 py-2.5 text-xs text-white/30 hover:text-white/60 transition-colors"
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
        <div className="px-6 pb-5 space-y-5">
          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Workspace admins */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-white/30 uppercase tracking-wider">Workspace admins</p>
              {!showAddAdmin && (
                <button
                  onClick={() => { setShowAddAdmin(true); setAddAdminResult(null) }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  + Add admin
                </button>
              )}
            </div>

            {/* Add admin form */}
            {showAddAdmin && (
              <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4 mb-3 space-y-3">
                {addAdminResult ? (
                  <div className="space-y-2">
                    {addAdminResult.direct ? (
                      <p className="text-sm text-emerald-400 font-medium">✓ Admin added directly</p>
                    ) : (
                      <>
                        <p className="text-sm text-yellow-400 font-medium">Invite sent (or copy link if email failed)</p>
                        {addAdminResult.inviteUrl && (
                          <div className="flex items-center gap-2">
                            <input
                              readOnly
                              value={addAdminResult.inviteUrl}
                              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/70 font-mono truncate"
                            />
                            <button
                              onClick={() => navigator.clipboard.writeText(addAdminResult.inviteUrl!)}
                              className="shrink-0 px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                            >
                              Copy
                            </button>
                          </div>
                        )}
                      </>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => { setAddAdminResult(null); setAdminEmail('') }}
                        className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                      >
                        Add another
                      </button>
                      <button
                        onClick={() => { setShowAddAdmin(false); setAddAdminResult(null) }}
                        className="px-3 py-1.5 text-xs text-white/40 hover:text-white rounded-lg transition-colors"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-white/40">
                      Enter an email address. If they have a Clem account they&apos;ll be added directly; otherwise an invite will be sent.
                    </p>
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        type="email"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addAdmin()}
                        placeholder="admin@theirdomain.com"
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                      <button
                        onClick={addAdmin}
                        disabled={addingAdmin || !adminEmail.trim()}
                        className="px-4 py-2 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg transition-colors shrink-0"
                      >
                        {addingAdmin ? 'Adding…' : 'Add'}
                      </button>
                      <button
                        onClick={() => { setShowAddAdmin(false); setAdminEmail(''); setError('') }}
                        className="px-3 py-2 text-xs text-white/40 hover:text-white rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {admins.length === 0 ? (
              <p className="text-xs text-white/20 italic">No admins assigned yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {admins.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate">{m.name ?? m.email ?? '—'}</p>
                      {m.email && (
                        <p className="text-xs text-white/40 truncate">{m.email}</p>
                      )}
                      <p className="text-[10px] text-white/20 font-mono truncate">{m.clerk_user_id}</p>
                    </div>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 shrink-0">
                      admin
                    </span>
                    <button
                      onClick={() => removeAdmin(m.id)}
                      disabled={removingId === m.id}
                      className="text-white/20 hover:text-red-400 transition-colors text-sm disabled:opacity-30 shrink-0"
                      title="Remove admin"
                    >
                      {removingId === m.id ? '…' : '✕'}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <p className="text-xs text-white/20 mt-2">
              Workspace members (authors, reviewers) are managed by the workspace admin via Settings → Team.
            </p>
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
