'use client'

import { useState } from 'react'

interface Props {
  tenantId: string
}

export default function TriggerSuggestButton({ tenantId }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleClick() {
    setStatus('loading')
    setMessage('')
    try {
      const res = await fetch('/api/clem/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Request failed')
      }
      setStatus('success')
      setMessage('5 new topic suggestions generated — refresh to see them.')
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={handleClick}
        disabled={status === 'loading' || status === 'success'}
        className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/40 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg text-sm transition-colors"
      >
        {status === 'loading' ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Generating…
          </>
        ) : status === 'success' ? (
          '✓ Done'
        ) : (
          '✦ Generate topics'
        )}
      </button>
      {message && (
        <p className={`text-xs ${status === 'error' ? 'text-red-400' : 'text-green-400'}`}>
          {message}
        </p>
      )}
    </div>
  )
}
