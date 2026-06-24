'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'

export interface NavWorkspace {
  tenantId: string
  role: string
  name: string
}

interface Props {
  isSuperAdmin: boolean
  canCreateWorkspace: boolean
  workspaces: NavWorkspace[]
  activeWorkspaceId: string | null
}

export default function DashboardNav({
  isSuperAdmin,
  canCreateWorkspace,
  workspaces,
  activeWorkspaceId,
}: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // ── Active-route helpers ────────────────────────────────────────────────────
  const scoutActive = pathname.startsWith('/dashboard/scout')
  const faqActive = pathname.startsWith('/dashboard/faq')
  const dashboardActive = pathname === '/dashboard' || (pathname.startsWith('/dashboard/') && !scoutActive && !faqActive)
  const authorActive = pathname.startsWith('/author')
  const clemActive = dashboardActive || authorActive || faqActive
  const settingsActive = pathname.startsWith('/settings')
  const adminActive = pathname.startsWith('/admin')
  const setupActive = pathname.startsWith('/setup')

  // ── Expansion state (default open when a child route is active) ────────────
  const [clemOpen, setClemOpen] = useState(clemActive)
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [switching, setSwitching] = useState(false)

  const activeWorkspace = workspaces.find((w) => w.tenantId === activeWorkspaceId) ?? workspaces[0] ?? null

  async function switchWorkspace(tenantId: string) {
    if (tenantId === activeWorkspace?.tenantId) { setWorkspaceOpen(false); return }
    setSwitching(true)
    try {
      await fetch('/api/workspace/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      })
      setWorkspaceOpen(false)
      setDrawerOpen(false)
      router.refresh()
    } finally {
      setSwitching(false)
    }
  }

  // ── Shared styles ───────────────────────────────────────────────────────────
  const itemBase = 'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors w-full text-left'
  const inactive = 'text-white/50 hover:text-white hover:bg-white/5'

  const NavLink = ({
    href, label, icon, active, accent = 'indigo', indent = false,
  }: {
    href: string; label: string; icon: string; active: boolean; accent?: 'indigo' | 'emerald'; indent?: boolean
  }) => (
    <Link
      href={href}
      onClick={() => setDrawerOpen(false)}
      className={`${itemBase} ${indent ? 'pl-9' : ''} ${
        active
          ? accent === 'emerald'
            ? 'bg-emerald-600/20 text-emerald-300 font-medium'
            : 'bg-indigo-600/20 text-indigo-300 font-medium'
          : inactive
      }`}
    >
      <span className="text-base leading-none w-4 text-center">{icon}</span>
      {label}
    </Link>
  )

  const Chevron = ({ open }: { open: boolean }) => (
    <svg
      className={`w-3 h-3 ml-auto transition-transform ${open ? 'rotate-180' : ''}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )

  // ── Nav content (shared by desktop sidebar + mobile drawer) ────────────────
  const NavContent = () => (
    <nav className="flex-1 space-y-0.5">
      {/* Clem — blog content agent */}
      <button
        type="button"
        onClick={() => setClemOpen((v) => !v)}
        className={`${itemBase} ${clemActive && !clemOpen ? 'text-indigo-300' : inactive}`}
      >
        <span className="w-4 flex justify-center">
          <span className="w-2 h-2 rounded-full bg-indigo-400" />
        </span>
        Clem
        <Chevron open={clemOpen} />
      </button>
      {clemOpen && (
        <div className="space-y-0.5">
          <NavLink href="/dashboard" label="Dashboard" icon="▦" active={dashboardActive} indent />
          <NavLink href="/dashboard/faq" label="FAQ" icon="❓" active={faqActive} indent />
          <NavLink href="/author" label="Author" icon="✎" active={authorActive} indent />
        </div>
      )}

      {/* Scout — SEO intelligence agent */}
      <Link
        href="/dashboard/scout"
        onClick={() => setDrawerOpen(false)}
        className={`${itemBase} ${scoutActive ? 'bg-emerald-600/20 text-emerald-300 font-medium' : inactive}`}
      >
        <span className="w-4 flex justify-center">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
        </span>
        Scout
      </Link>

      <div className="pt-3 mt-3 border-t border-white/10" />

      {/* Workspace switcher */}
      {activeWorkspace && (
        <>
          <button
            type="button"
            onClick={() => workspaces.length > 1 && setWorkspaceOpen((v) => !v)}
            disabled={switching}
            className={`${itemBase} ${inactive} disabled:opacity-50`}
          >
            <span className="text-base leading-none w-4 text-center">⊞</span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-white/30">Workspace</span>
              <span className="block truncate text-white/70">
                {switching ? 'Switching…' : activeWorkspace.name}
                <span className="text-white/30 capitalize"> · {activeWorkspace.role}</span>
              </span>
            </span>
            {workspaces.length > 1 && <Chevron open={workspaceOpen} />}
          </button>
          {workspaceOpen && workspaces.length > 1 && (
            <div className="space-y-0.5">
              {workspaces.map((w) => (
                <button
                  key={w.tenantId}
                  type="button"
                  onClick={() => switchWorkspace(w.tenantId)}
                  disabled={switching}
                  className={`${itemBase} pl-9 ${
                    w.tenantId === activeWorkspace.tenantId
                      ? 'bg-indigo-600/20 text-indigo-300 font-medium'
                      : inactive
                  } disabled:opacity-50`}
                >
                  <span className="truncate">{w.name}</span>
                  <span className="text-xs text-white/30 capitalize ml-auto shrink-0">{w.role}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <NavLink href="/settings" label="Settings" icon="⚙" active={settingsActive} />
      {canCreateWorkspace && <NavLink href="/setup" label="Create workspace" icon="+" active={setupActive} />}
      {isSuperAdmin && <NavLink href="/admin" label="Admin" icon="◈" active={adminActive} />}
    </nav>
  )

  const Brand = () => (
    <span className="text-lg font-semibold tracking-tight text-white/90">
      Agent <span className="text-indigo-400">Roster</span>
    </span>
  )

  return (
    <>
      {/* ── Desktop sidebar (md+) ── */}
      <aside className="hidden md:flex w-56 shrink-0 border-r border-white/10 flex-col px-4 py-6 gap-1 bg-slate-900">
        <div className="px-2 mb-6">
          <Brand />
        </div>

        <NavContent />

        <div className="px-2 pt-4 border-t border-white/10 flex items-center gap-3">
          <UserButton />
          <span className="text-xs text-white/40 truncate">My account</span>
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-slate-900 border-b border-white/10 flex items-center justify-between px-4 py-3">
        <Brand />
        <div className="flex items-center gap-3">
          <UserButton />
          <button
            onClick={() => setDrawerOpen((v) => !v)}
            aria-label="Open menu"
            className="w-9 h-9 flex flex-col items-center justify-center gap-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <span className={`block w-5 h-0.5 bg-white transition-all ${drawerOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block w-5 h-0.5 bg-white transition-all ${drawerOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-5 h-0.5 bg-white transition-all ${drawerOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Mobile drawer overlay ── */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Mobile drawer panel ── */}
      <div
        className={`md:hidden fixed top-0 right-0 bottom-0 z-40 w-72 bg-slate-900 flex flex-col px-4 py-6 gap-1 transition-transform duration-300 ${
          drawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="px-2 mb-6 flex items-center justify-between">
          <Brand />
          <button
            onClick={() => setDrawerOpen(false)}
            className="text-white/40 hover:text-white transition-colors text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <NavContent />

        <div className="px-2 pt-4 border-t border-white/10 flex items-center gap-3">
          <UserButton />
          <span className="text-xs text-white/40 truncate">My account</span>
        </div>
      </div>

    </>
  )
}
