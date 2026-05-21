'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'

interface Props {
  isSuperAdmin: boolean
  canCreateWorkspace: boolean
}

const coreNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '▦' },
  { href: '/dashboard/scout', label: 'Scout', icon: '◉' },
  { href: '/author', label: 'Author', icon: '✎' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
]

export default function DashboardNav({ isSuperAdmin, canCreateWorkspace }: Props) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const navItems = [
    ...coreNavItems,
    ...(canCreateWorkspace ? [{ href: '/setup', label: 'Create workspace', icon: '+' }] : []),
    ...(isSuperAdmin ? [{ href: '/admin', label: 'Admin', icon: '◈' }] : []),
  ]

  const NavLink = ({ href, label, icon }: { href: string; label: string; icon: string }) => {
    const active = pathname === href || pathname.startsWith(`${href}/`)
    return (
      <Link
        href={href}
        onClick={() => setDrawerOpen(false)}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
          active
            ? 'bg-indigo-600/20 text-indigo-300 font-medium'
            : 'text-white/50 hover:text-white hover:bg-white/5'
        }`}
      >
        <span className="text-base leading-none w-4 text-center">{icon}</span>
        {label}
      </Link>
    )
  }

  return (
    <>
      {/* ── Desktop sidebar (md+) ── */}
      <aside className="hidden md:flex w-56 shrink-0 border-r border-white/10 flex-col px-4 py-6 gap-1 bg-slate-900">
        <div className="px-2 mb-6">
          <span className="text-lg font-semibold tracking-tight">
            <span className="text-indigo-400">Clem</span>
          </span>
        </div>

        <nav className="flex-1 space-y-0.5">
          {navItems.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>

        <div className="px-2 pt-4 border-t border-white/10 flex items-center gap-3">
          <UserButton />
          <span className="text-xs text-white/40 truncate">My account</span>
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-slate-900 border-b border-white/10 flex items-center justify-between px-4 py-3">
        <span className="text-lg font-semibold tracking-tight">
          <span className="text-indigo-400">Clem</span>
        </span>
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
          <span className="text-lg font-semibold tracking-tight">
            <span className="text-indigo-400">Clem</span>
          </span>
          <button
            onClick={() => setDrawerOpen(false)}
            className="text-white/40 hover:text-white transition-colors text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 space-y-0.5">
          {navItems.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>

        <div className="px-2 pt-4 border-t border-white/10 flex items-center gap-3">
          <UserButton />
          <span className="text-xs text-white/40 truncate">My account</span>
        </div>
      </div>

    </>
  )
}
