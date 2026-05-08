'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'

interface Props {
  isSuperAdmin: boolean
  canCreateWorkspace: boolean
}

const coreNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '▦' },
  { href: '/author', label: 'Author', icon: '✎' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
]

export default function DashboardNav({ isSuperAdmin, canCreateWorkspace }: Props) {
  const pathname = usePathname()

  const navItems = [
    ...coreNavItems,
    ...(canCreateWorkspace ? [{ href: '/setup', label: 'Create workspace', icon: '+' }] : []),
    ...(isSuperAdmin ? [{ href: '/admin', label: 'Admin', icon: '◈' }] : []),
  ]

  return (
    <aside className="w-56 shrink-0 border-r border-white/10 flex flex-col px-4 py-6 gap-1">
      <div className="px-2 mb-6">
        <span className="text-lg font-semibold tracking-tight">
          <span className="text-indigo-400">Clem</span>
        </span>
      </div>

      <nav className="flex-1 space-y-0.5">
        {navItems.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-indigo-600/20 text-indigo-300'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="text-base leading-none">{icon}</span>
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="px-2 pt-4 border-t border-white/10 flex items-center gap-3">
        <UserButton />
        <span className="text-xs text-white/40 truncate">My account</span>
      </div>
    </aside>
  )
}
