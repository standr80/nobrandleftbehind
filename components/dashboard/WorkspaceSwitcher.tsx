'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Workspace {
  tenantId: string
  role: string
  tenant: {
    id: string
    name: string
    domain: string
    logo_url?: string | null
    billing_tier?: string | null
  } | null
}

interface Props {
  workspaces: Workspace[]
  activeId: string
  canCreateWorkspace?: boolean
}

export default function WorkspaceSwitcher({ workspaces, activeId, canCreateWorkspace = false }: Props) {
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const active = workspaces.find((w) => w.tenantId === activeId) ?? workspaces[0]
  const others = workspaces.filter((w) => w.tenantId !== activeId)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function switchWorkspace(tenantId: string) {
    setSwitching(true)
    setOpen(false)
    try {
      await fetch('/api/workspace/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      })
      router.refresh()
    } finally {
      setSwitching(false)
    }
  }

  if (workspaces.length <= 1) return null

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={switching}
        className="flex items-center gap-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-sm transition-colors disabled:opacity-50"
      >
        <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
        <span className="font-medium text-slate-900 truncate max-w-[200px]">
          {active?.tenant?.name ?? 'Select workspace'}
        </span>
        {active?.tenant?.domain && (
          <span className="text-slate-400 text-xs hidden sm:block truncate max-w-[160px]">
            {active.tenant.domain}
          </span>
        )}
        <svg
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full mt-1.5 left-0 z-50 bg-white border border-slate-200 rounded-xl shadow-xl min-w-[260px] overflow-hidden">
          <div className="px-3 pt-3 pb-1.5">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Your workspaces</p>
          </div>

          {/* Active workspace */}
          <div className="px-3 pb-1">
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-indigo-50 border border-indigo-200">
              <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{active?.tenant?.name}</p>
                <p className="text-xs text-slate-400 truncate">{active?.tenant?.domain}</p>
              </div>
              <span className="ml-auto text-[10px] text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full shrink-0">
                active
              </span>
            </div>
          </div>

          {/* Other workspaces */}
          {others.length > 0 && (
            <>
              <div className="mx-3 border-t border-slate-100 my-1" />
              <div className="px-3 pb-2 space-y-0.5">
                {others.map((w) => (
                  <button
                    key={w.tenantId}
                    onClick={() => switchWorkspace(w.tenantId)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-white transition-colors text-left"
                  >
                    <span className="w-2 h-2 rounded-full bg-white/20 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-slate-800 truncate">{w.tenant?.name}</p>
                      <p className="text-xs text-slate-400 truncate">{w.tenant?.domain}</p>
                    </div>
                    <span className="ml-auto text-xs text-slate-400 capitalize shrink-0">{w.role}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {canCreateWorkspace && (
            <div className="border-t border-slate-100 p-2">
              <a
                href="/setup"
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white transition-colors text-sm text-slate-500 hover:text-slate-800"
              >
                <span className="text-base leading-none">+</span>
                <span>New workspace</span>
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
