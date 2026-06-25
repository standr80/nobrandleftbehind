'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ScoutRunButton({ tenantId }: { tenantId: string }) {
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleRun() {
    setRunning(true)
    setError(null)
    try {
      const res = await fetch('/api/scout/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Scout run failed')
      } else {
        router.push(`/dashboard/scout/briefings/${data.briefingId}`)
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleRun}
        disabled={running}
        className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {running ? 'Running Scout…' : 'Run Scout now'}
      </button>
      {running && (
        <span className="text-xs text-slate-400">This may take up to 2 minutes</span>
      )}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}
