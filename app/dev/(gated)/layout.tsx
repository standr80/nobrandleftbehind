import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'R&D — No Brand Left Behind',
  // Internal working documents: keep them out of search results entirely,
  // independently of the password gate.
  robots: { index: false, follow: false, nocache: true },
}

export default function DevLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/dev" className="group flex items-baseline gap-2.5">
            <span className="text-sm font-semibold tracking-tight text-slate-900 group-hover:text-slate-600">
              R&amp;D
            </span>
            <span className="text-xs text-slate-400">No Brand Left Behind</span>
          </Link>
          <form action="/api/dev/logout" method="POST">
            <button
              type="submit"
              className="rounded-md px-2.5 py-1 text-xs text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-10">{children}</main>
      <footer className="mx-auto max-w-4xl px-6 pb-12 pt-4">
        <p className="border-t border-slate-200 pt-4 text-xs text-slate-400">
          Internal working documents — Event Stuff Ltd. Please don&apos;t forward the
          password or these links outside the team.
        </p>
      </footer>
    </div>
  )
}
