'use client'

import { useState } from 'react'

interface Membership {
  tenantId: string
  tenantName: string
  role: string
}

interface UserRow {
  clerkUserId: string
  name: string | null
  email: string | null
  lastSignInAt: number | null
  memberships: Membership[]
}

interface Props {
  users: UserRow[]
}

function formatDate(ts: number | null) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const ROLE_STYLES: Record<string, string> = {
  admin: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  author: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  reviewer: 'bg-blue-50 text-blue-700 border-blue-200',
}

export default function UserList({ users }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const filtered = users.filter((u) => {
    const q = search.toLowerCase()
    return (
      !q ||
      u.email?.toLowerCase().includes(q) ||
      u.name?.toLowerCase().includes(q) ||
      u.clerkUserId.includes(q)
    )
  })

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden mt-8">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium text-slate-700">All users</h2>
          <p className="text-xs text-slate-400 mt-0.5">{users.length} account{users.length !== 1 ? 's' : ''}</p>
        </div>
        <input
          type="search"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors w-56"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="px-6 py-8 text-sm text-slate-400 text-center">No users found.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {filtered.map((u) => (
            <li key={u.clerkUserId}>
              <button
                onClick={() => setExpanded((prev) => (prev === u.clerkUserId ? null : u.clerkUserId))}
                className="w-full flex items-center gap-4 px-6 py-3.5 hover:bg-white transition-colors text-left"
              >
                {/* Avatar placeholder */}
                <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-xs font-medium text-indigo-600 shrink-0">
                  {(u.name ?? u.email ?? '?')[0].toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  {/* Show name if set, otherwise email is the primary identifier */}
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {u.name ?? u.email ?? '—'}
                  </p>
                  {u.name && (
                    <p className="text-xs text-slate-400 truncate">{u.email ?? u.clerkUserId}</p>
                  )}
                </div>

                {/* Workspaces badge */}
                <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                  {u.memberships.slice(0, 3).map((m) => (
                    <span
                      key={m.tenantId}
                      className={`text-[10px] px-2 py-0.5 rounded-full border capitalize ${ROLE_STYLES[m.role] ?? 'bg-white text-slate-400 border-slate-200'}`}
                    >
                      {m.tenantName} · {m.role}
                    </span>
                  ))}
                  {u.memberships.length > 3 && (
                    <span className="text-[10px] text-slate-400">+{u.memberships.length - 3} more</span>
                  )}
                </div>

                <div className="text-right shrink-0 hidden md:block">
                  <p className="text-xs text-slate-400">Last sign-in</p>
                  <p className="text-xs text-slate-500">{formatDate(u.lastSignInAt)}</p>
                </div>

                <svg
                  className={`w-3.5 h-3.5 text-slate-300 shrink-0 transition-transform ${expanded === u.clerkUserId ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {expanded === u.clerkUserId && (
                <div className="px-6 pb-4 pt-1 bg-slate-50 border-t border-slate-100">
                  <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
                    <div>
                      <p className="text-slate-400 mb-0.5">Email</p>
                      <p className="text-slate-600 truncate">{u.email ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 mb-0.5">Name</p>
                      <p className="text-slate-600">{u.name ?? <span className="italic text-slate-300">not set</span>}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 mb-0.5">Clerk ID</p>
                      <p className="font-mono text-slate-500 text-[10px] break-all">{u.clerkUserId}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 mb-0.5">Last sign-in</p>
                      <p className="text-slate-600">{formatDate(u.lastSignInAt)}</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 mb-2">Workspace memberships</p>
                  {u.memberships.length === 0 ? (
                    <p className="text-xs text-slate-300 italic">No workspace memberships.</p>
                  ) : (
                    <div className="space-y-1">
                      {u.memberships.map((m) => (
                        <div key={m.tenantId} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2">
                          <p className="text-xs text-slate-700 flex-1 truncate">{m.tenantName}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border capitalize ${ROLE_STYLES[m.role] ?? 'bg-white text-slate-400 border-slate-200'}`}>
                            {m.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
