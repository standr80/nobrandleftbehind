'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  token: string
  workspaceName: string
  workspaceDomain: string
  inviteEmail: string
  role: string
}

export default function InviteAccept({ token, workspaceName, workspaceDomain, inviteEmail, role }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function accept() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/invite/${token}`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to accept invite')
        return
      }
      router.push('/dashboard')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md w-full mx-auto px-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-2xl mx-auto mb-6">
          ✦
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">You&apos;re invited</h1>
        <p className="text-slate-500 text-sm mb-6">
          You&apos;ve been invited to join{' '}
          <span className="text-white font-medium">{workspaceName}</span>
          {workspaceDomain && (
            <>
              {' '}(<span className="text-indigo-600">{workspaceDomain}</span>)
            </>
          )}{' '}
          as a <span className="text-white font-medium capitalize">{role}</span>.
        </p>

        <p className="text-slate-400 text-xs mb-6">
          Invite sent to <span className="text-slate-600">{inviteEmail}</span>
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 text-left">
            {error}
          </div>
        )}

        <button
          onClick={accept}
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-3 px-6 rounded-xl transition-colors"
        >
          {loading ? 'Accepting…' : 'Accept invitation'}
        </button>

        <p className="text-slate-300 text-xs mt-4">
          By accepting, you&apos;ll be added to this workspace and can start collaborating immediately.
        </p>
      </div>
    </div>
  )
}
