import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function LandingPage() {
  const { userId } = await auth()
  if (userId) redirect('/dashboard')

  return (
    <main className="min-h-screen bg-white text-slate-900 flex flex-col">
      {/* Nav */}
      <nav className="border-b border-slate-100 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight text-slate-900">nobrandleftbehind</span>
          <span className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-full font-medium">
            beta
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/sign-in" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="text-sm bg-slate-900 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex items-center justify-center px-6 py-20 text-center">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-indigo-600 mb-4 tracking-wide uppercase">
            AI-powered content agents
          </p>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-6 text-slate-900 leading-tight">
            No brand left behind.
          </h1>
          <p className="text-lg text-slate-500 mb-12 max-w-2xl mx-auto leading-relaxed">
            A suite of intelligent agents that handle the time-consuming work of growing your
            brand — from blog writing to sales prospecting — so you can focus on what matters.
          </p>

          {/* Agent cards */}
          <div className="grid sm:grid-cols-2 gap-4 mb-12 text-left">
            {/* Clem */}
            <div className="group relative bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                  C
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900">Clem</h2>
                  <p className="text-xs text-slate-400">Blog content agent</p>
                </div>
                <span className="ml-auto text-xs bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-full">
                  Live
                </span>
              </div>
              <p className="text-sm text-slate-500 mb-4">
                Researches, writes, and queues SEO-ready blog posts for your website — on a
                schedule you control.
              </p>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 text-sm text-indigo-600 font-medium hover:text-indigo-700 transition-colors group-hover:gap-2.5"
              >
                Open Clem
                <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </div>

            {/* Hank — coming soon */}
            <div className="relative bg-slate-50 border border-slate-200 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-slate-300 flex items-center justify-center text-white font-bold text-lg">
                  H
                </div>
                <div>
                  <h2 className="font-semibold text-slate-400">Hank</h2>
                  <p className="text-xs text-slate-400">Sales prospecting agent</p>
                </div>
                <span className="ml-auto text-xs bg-slate-100 text-slate-400 border border-slate-200 px-2 py-0.5 rounded-full">
                  Coming soon
                </span>
              </div>
              <p className="text-sm text-slate-400">
                Finds, qualifies, and nurtures sales prospects — automating the top of your
                sales funnel.
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-300">
            More agents coming. Built by{' '}
            <span className="text-slate-400 font-medium">nobrandleftbehind</span>.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 px-6 py-6 max-w-7xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-slate-400">
          © {new Date().getFullYear()} nobrandleftbehind. All rights reserved.
        </p>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <Link href="/sign-in" className="hover:text-slate-600 transition-colors">Sign in</Link>
          <Link href="/sign-up" className="hover:text-slate-600 transition-colors">Sign up</Link>
        </div>
      </footer>
    </main>
  )
}
