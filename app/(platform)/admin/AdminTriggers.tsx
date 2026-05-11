'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  tenantId: string
  tenantName: string
}

type Job = 'suggest' | 'crawl'

export default function AdminTriggers({ tenantId, tenantName }: Props) {
  const router = useRouter()
  const [running, setRunning] = useState<Job | null>(null)
  const [result, setResult] = useState<string | null>(null)

  async function trigger(job: Job) {
    setRunning(job)
    setResult(null)
    const endpoint = job === 'suggest' ? '/api/clem/suggest' : '/api/clem/crawl'
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setResult(`✓ ${job === 'suggest' ? 'Suggestions' : 'Crawl'} triggered for ${tenantName}`)
      router.refresh()
    } catch (err) {
      setResult(err instanceof Error ? err.message : 'Error')
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className="flex items-center gap-1">
      {result && <span className="text-xs text-slate-400 mr-2 max-w-[160px] truncate">{result}</span>}
      <button
        onClick={() => trigger('crawl')}
        disabled={running !== null}
        title="Re-crawl site"
        className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 text-slate-500 hover:text-white rounded-lg transition-colors"
      >
        {running === 'crawl' ? '…' : '↺ Crawl'}
      </button>
      <button
        onClick={() => trigger('suggest')}
        disabled={running !== null}
        title="Generate topic suggestions"
        className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 text-slate-500 hover:text-white rounded-lg transition-colors"
      >
        {running === 'suggest' ? '…' : '✦ Suggest'}
      </button>
    </div>
  )
}
