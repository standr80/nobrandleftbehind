'use client'

import { useState } from 'react'

interface Alert {
  id: string
  alert_type: string
  severity: string | null
  title: string
  detail: string | null
  created_at: string | null
}

interface Props {
  initialAlerts: Alert[]
  tenantId: string
}

function fmtAge(dateStr: string | null): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (mins > 0) return `${mins}m ago`
  return 'just now'
}

function fmtFull(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function ScoutAlertsList({ initialAlerts, tenantId }: Props) {
  const [alerts, setAlerts] = useState(initialAlerts)
  const [dismissing, setDismissing] = useState<string | null>(null)

  async function dismiss(id: string) {
    setDismissing(id)
    try {
      await fetch(`/api/scout/alerts/${id}?tenantId=${encodeURIComponent(tenantId)}`, { method: 'PATCH' })
      setAlerts((prev) => prev.filter((a) => a.id !== id))
    } finally {
      setDismissing(null)
    }
  }

  if (alerts.length === 0) {
    return <p className="text-sm text-slate-400">No active alerts.</p>
  }

  const urgent = alerts.filter((a) => a.severity === 'urgent' || a.severity === null)
  const watch = alerts.filter((a) => a.severity === 'watch')

  return (
    <div className="space-y-2">
      {[...urgent, ...watch].map((alert) => {
        const isUrgent = alert.severity === 'urgent' || alert.severity === null
        return (
          <div
            key={alert.id}
            className={`flex gap-3 p-3 rounded-lg border ${
              isUrgent ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'
            }`}
          >
            <span className="text-base leading-none mt-0.5 shrink-0">
              {isUrgent ? '🔴' : '🟡'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-900 leading-snug">
                {alert.title}
              </div>
              {alert.detail && (
                <div className="text-xs text-slate-500 mt-0.5 break-words">{alert.detail}</div>
              )}
              <div
                className="text-xs text-slate-400 mt-1"
                title={fmtFull(alert.created_at)}
              >
                {fmtAge(alert.created_at)}
              </div>
            </div>
            <button
              onClick={() => dismiss(alert.id)}
              disabled={dismissing === alert.id}
              title="Dismiss"
              className="shrink-0 text-slate-300 hover:text-slate-500 transition-colors disabled:opacity-40 self-start mt-0.5"
            >
              {dismissing === alert.id ? (
                <span className="text-xs">…</span>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z" />
                </svg>
              )}
            </button>
          </div>
        )
      })}
    </div>
  )
}
