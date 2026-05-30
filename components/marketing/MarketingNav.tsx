import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'

export default async function MarketingNav() {
  const { userId } = await auth()

  return (
    <nav className="border-b border-slate-100 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto w-full">
      <div className="flex items-center gap-2">
        <Link href="/" className="text-xl font-bold tracking-tight text-slate-900">
          nobrandleftbehind
        </Link>
        <span className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-full font-medium">
          beta
        </span>
      </div>
      <div className="flex items-center gap-3 sm:gap-5">
        <Link href="/#how-it-works" className="hidden sm:inline text-sm text-slate-500 hover:text-slate-900 transition-colors">
          How it works
        </Link>
        <Link href="/#features" className="hidden sm:inline text-sm text-slate-500 hover:text-slate-900 transition-colors">
          Features
        </Link>
        <Link href="/academy" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
          Academy
        </Link>
        {userId ? (
          <Link
            href="/dashboard"
            className="text-sm bg-slate-900 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
          >
            Dashboard →
          </Link>
        ) : (
          <>
            <Link href="/sign-in" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="text-sm bg-slate-900 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
            >
              Get started
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
