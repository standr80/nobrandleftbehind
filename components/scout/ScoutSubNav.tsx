'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const scoutNav = [
  { href: '/dashboard/scout', label: 'Overview', exact: true },
  { href: '/dashboard/scout/briefings', label: 'Briefings' },
  { href: '/dashboard/scout/competitors', label: 'Competitors' },
  { href: '/dashboard/scout/keywords', label: 'Keywords' },
  { href: '/dashboard/scout/settings', label: 'Settings' },
]

export default function ScoutSubNav() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1 border-b border-slate-200 overflow-x-auto">
      {scoutNav.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              active
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
