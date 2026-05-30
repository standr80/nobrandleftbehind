import type { Metadata } from 'next'
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nobrandleftbehind.com'
const TITLE = 'No Brand Left Behind — AI agents that grow your brand'
const DESCRIPTION =
  'A suite of intelligent AI agents that handle the time-consuming work of growing your brand — from SEO blog writing to sales prospecting — so you can focus on what matters.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'No Brand Left Behind',
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
}

// ── Agent roster ──────────────────────────────────────────────────────────────
// Drop a 800×800 JPEG into /public/agents/ and set the photo property.
// Leave photo as null to show the placeholder initial tile.
const agents = [
  {
    id: 'clem',
    name: 'Clem',
    role: 'Blog content agent',
    description:
      'Researches, writes, and queues SEO-ready blog posts for your website — on a schedule you control.',
    status: 'live' as const,
    href: '/dashboard',
    cta: 'Hire Clem',
    photo: '/agents/clem.jpg' as string | null,
    accent: '#4f46e5', // indigo
  },
  {
    id: 'hank',
    name: 'Hank',
    role: 'Sales prospecting agent',
    description:
      'Finds, qualifies, and nurtures sales prospects — automating the top of your sales funnel.',
    status: 'soon' as const,
    href: null,
    cta: null,
    photo: '/agents/hank.jpg' as string | null,
    accent: '#64748b', // slate
  },
]

export default async function LandingPage() {
  const { userId } = await auth()

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

      {/* Hero */}
      <section className="flex-1 flex items-center justify-center px-6 py-20 text-center">
        <div className="max-w-3xl w-full">
          <p className="text-sm font-medium text-indigo-600 mb-4 tracking-wide uppercase">
            AI-powered content agents
          </p>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-6 text-slate-900 leading-tight">
            No brand left behind.
          </h1>
          <p className="text-lg text-slate-500 mb-14 max-w-2xl mx-auto leading-relaxed">
            A suite of intelligent agents that handle the time-consuming work of growing your
            brand — from blog writing to sales prospecting — so you can focus on what matters.
          </p>

          {/* Agent cards */}
          <div className="grid sm:grid-cols-2 gap-6 mb-12 text-left">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className={`group rounded-2xl overflow-hidden border transition-all ${
                  agent.status === 'live'
                    ? 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                {/* Photo */}
                <div className="aspect-square overflow-hidden relative">
                  {agent.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={agent.photo}
                      alt={`${agent.name} — ${agent.role}`}
                        className={`w-full h-full object-cover object-top transition-transform duration-500 ${
                        agent.status === 'live' ? 'group-hover:scale-105' : ''
                      }`}
                    />
                  ) : (
                    /* Placeholder until photo is ready */
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{
                        background: agent.status === 'live'
                          ? `linear-gradient(135deg, ${agent.accent}18 0%, ${agent.accent}30 100%)`
                          : 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                      }}
                    >
                      <span
                        className="text-9xl font-black select-none"
                        style={{
                          color: agent.status === 'live' ? `${agent.accent}40` : '#94a3b8',
                          letterSpacing: '-0.05em',
                        }}
                      >
                        {agent.name[0]}
                      </span>
                    </div>
                  )}

                  {/* Status badge — overlaid on photo */}
                  <div className="absolute top-3 right-3">
                    {agent.status === 'live' ? (
                      <span className="text-xs bg-emerald-50 text-emerald-600 border border-emerald-200 px-2.5 py-1 rounded-full font-medium shadow-sm">
                        Live
                      </span>
                    ) : (
                      <span className="text-xs bg-white/80 text-slate-400 border border-slate-200 px-2.5 py-1 rounded-full font-medium shadow-sm">
                        Coming soon
                      </span>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="p-5">
                  <div className="mb-3">
                    <h2 className={`text-lg font-bold ${agent.status === 'live' ? 'text-slate-900' : 'text-slate-400'}`}>
                      {agent.name}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">{agent.role}</p>
                  </div>

                  <p className={`text-sm leading-relaxed mb-4 ${agent.status === 'live' ? 'text-slate-500' : 'text-slate-400'}`}>
                    {agent.description}
                  </p>

                  {agent.href && agent.cta && (
                    <Link
                      href={agent.href}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-all group-hover:gap-2.5"
                    >
                      {agent.cta}
                      <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                    </Link>
                  )}
                </div>
              </div>
            ))}
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
