import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import MarketingNav from '@/components/marketing/MarketingNav'
import MarketingFooter from '@/components/marketing/MarketingFooter'
import { agents, getAgent } from '@/lib/marketing/agents'
import { BOOKING_URL } from '@/lib/marketing/config'

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nobrandleftbehind.com'

export function generateStaticParams() {
  return agents.map((a) => ({ slug: a.id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const agent = getAgent(slug)
  if (!agent) return { title: 'Agent not found' }
  const title = `${agent.name} — ${agent.role} | No Brand Left Behind`
  return {
    title,
    description: agent.tagline,
    alternates: { canonical: `${SITE_URL}/agents/${agent.id}` },
    openGraph: {
      type: 'profile',
      url: `${SITE_URL}/agents/${agent.id}`,
      siteName: 'No Brand Left Behind',
      title,
      description: agent.tagline,
    },
  }
}

export default async function AgentCvPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const agent = getAgent(slug)
  if (!agent) notFound()

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <MarketingNav />

      <div className="flex-1 px-6 py-12">
        <div className="max-w-3xl mx-auto">
          <Link href="/#agents" className="text-sm text-slate-400 hover:text-slate-700 transition-colors">
            ← All agents
          </Link>

          {/* CV paper */}
          <article className="relative mt-4 bg-white rounded-sm border border-slate-200 shadow-xl p-8 sm:p-10">
            {/* Paperclip */}
            <svg
              aria-hidden
              className="absolute -top-3 left-8 w-8 h-8 text-slate-300 rotate-6 drop-shadow-sm"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 7v9a4 4 0 008 0V6a2.5 2.5 0 00-5 0v9.5a1 1 0 002 0V7"
              />
            </svg>

            {/* Header: passport photo + identity */}
            <header className="flex gap-6 items-start border-b border-slate-100 pb-6">
              <div
                className="shrink-0 w-24 h-28 rounded-sm overflow-hidden border border-slate-200 shadow-sm"
                style={{ background: `${agent.accent}14` }}
              >
                {agent.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={agent.photo} alt={`${agent.name} — ${agent.role}`} className="w-full h-full object-cover object-top" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-5xl font-black select-none" style={{ color: `${agent.accent}66` }}>
                      {agent.name[0]}
                    </span>
                  </div>
                )}
              </div>

              <div className="min-w-0 pt-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-3xl font-bold tracking-tight">{agent.name}</h1>
                  {agent.status === 'live' ? (
                    <span className="text-xs bg-emerald-50 text-emerald-600 border border-emerald-200 px-2.5 py-1 rounded-full font-medium">Live</span>
                  ) : (
                    <span className="text-xs bg-slate-100 text-slate-400 border border-slate-200 px-2.5 py-1 rounded-full font-medium">Coming soon</span>
                  )}
                </div>
                <p className="text-sm font-medium mt-1" style={{ color: agent.accent }}>{agent.role}</p>
                <p className="text-slate-500 mt-3 leading-relaxed">{agent.tagline}</p>
              </div>
            </header>

            {/* Profile */}
            <section className="mt-6">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Profile</h2>
              <p className="text-slate-600 leading-relaxed">{agent.summary}</p>
            </section>

            {/* Skills */}
            <section className="mt-6">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Skills</h2>
              <div className="flex flex-wrap gap-2">
                {agent.skills.map((s) => (
                  <span key={s} className="text-xs bg-slate-100 text-slate-600 rounded-full px-3 py-1">{s}</span>
                ))}
              </div>
            </section>

            {/* Experience */}
            <section className="mt-6">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Experience</h2>
              <div className="space-y-4">
                {agent.experience.map((role) => (
                  <div key={role.title}>
                    <h3 className="text-sm font-semibold text-slate-900">{role.title}</h3>
                    <ul className="mt-1.5 space-y-1">
                      {role.points.map((p) => (
                        <li key={p} className="text-sm text-slate-600 leading-relaxed flex gap-2">
                          <span className="mt-2 w-1 h-1 rounded-full shrink-0" style={{ background: agent.accent }} />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            {/* Tools */}
            {agent.tools && agent.tools.length > 0 && (
              <section className="mt-6">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Tools & integrations</h2>
                <div className="flex flex-wrap gap-2">
                  {agent.tools.map((t) => (
                    <span key={t} className="text-xs border border-slate-200 text-slate-500 rounded-full px-3 py-1">{t}</span>
                  ))}
                </div>
              </section>
            )}

            {/* CTA */}
            <footer className="mt-8 pt-6 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <a
                  href={BOOKING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg transition-colors font-medium"
                >
                  Arrange an interview →
                </a>
                <span className="text-xs text-slate-400">
                  {agent.status === 'live'
                    ? `Ready to hire ${agent.name}? Book a quick call.`
                    : `${agent.name} is joining the team soon — book a call to talk through the roadmap.`}
                </span>
              </div>
            </footer>
          </article>
        </div>
      </div>

      <MarketingFooter />
    </main>
  )
}
