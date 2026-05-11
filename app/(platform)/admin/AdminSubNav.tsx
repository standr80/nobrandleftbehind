'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/admin/workspaces', label: 'Workspaces' },
  { href: '/admin/quotas', label: 'Creation access' },
  { href: '/admin/users', label: 'Users' },
]

export default function AdminSubNav() {
  const pathname = usePathname()

  return (
    <div className="flex gap-1 border-b border-white/10 mb-8 -mx-1">
      {tabs.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link
            key={href}
            href={href}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              active
                ? 'border-indigo-500 text-indigo-300'
                : 'border-transparent text-white/40 hover:text-white/70'
            }`}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}
