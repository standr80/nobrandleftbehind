'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  tenantId: string
  currentSuggestionCount?: number
}

const POLL_INTERVAL_MS = 4000
const MAX_POLLS = 20 // ~80 seconds before giving up

export default function TriggerSuggestButton({ tenantId, currentSuggestionCount = 0 }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'loading' | 'waiting' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const baselineCountRef = useRef(currentSuggestionCount)

  // When the parent re-renders with a higher suggestion count, new topics arrived — stop polling
  useEffect(() => {
    if (status === 'waiting' && currentSuggestionCount > baselineCountRef.current) {
      stopPolling()
      setStatus('success')
    }
  }, [currentSuggestionCount, status])

  useEffect(() => {
    return () => stopPolling()
  }, [])

  function stopPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  async function handleClick() {
    if (status === 'loading' || status === 'waiting') return
    setStatus('loading')
    setError('')
    baselineCountRef.current = currentSuggestionCount

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

      setStatus('waiting')

      // Poll router.refresh() until new suggestions appear or timeout
      let polls = 0
      pollingRef.current = setInterval(() => {
        polls++
        router.refresh()
        if (polls >= MAX_POLLS) {
          stopPolling()
          setStatus('success') // graceful timeout — user can refresh manually
        }
      }, POLL_INTERVAL_MS)
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={handleClick}
        disabled={status === 'loading' || status === 'waiting'}
        className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/40 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg text-sm transition-colors"
      >
        {status === 'loading' || status === 'waiting' ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            {status === 'loading' ? 'Generating…' : 'Working…'}
          </>
        ) : status === 'success' ? (
          '✦ Generate more topics'
        ) : (
          '✦ Generate topics'
        )}
      </button>
      {status === 'waiting' && (
        <p className="text-xs text-slate-400 text-center max-w-xs">
          Clem is researching and writing — usually takes 15–30 seconds.
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
