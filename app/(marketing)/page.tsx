import type { Metadata } from 'next'
import Link from 'next/link'
import MarketingNav from '@/components/marketing/MarketingNav'
import MarketingFooter from '@/components/marketing/MarketingFooter'
import { agents } from '@/lib/marketing/agents'
import { BOOKING_URL } from '@/lib/marketing/config'

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


const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      name: 'No Brand Left Behind',
      url: SITE_URL,
      description: DESCRIPTION,
    },
    {
      '@type': 'SoftwareApplication',
      name: 'No Brand Left Behind',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: DESCRIPTION,
      url: SITE_URL,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' },
    },
  ],
}

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900 flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MarketingNav />

      {/* Hero */}
      <section id="agents" className="flex items-center justify-center px-6 py-20 text-center scroll-mt-20">
        <div className="max-w-3xl w-full">
          <p className="text-sm font-medium text-indigo-600 mb-4 tracking-wide uppercase">
            AI-powered content agents
          </p>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-6 text-slate-900 leading-tight">
            No brand left behind.
          </h1>
          <p className="text-lg text-slate-500 mb-8 max-w-2xl mx-auto leading-relaxed">
            A suite of intelligent agents that handle the time-consuming work of growing your
            brand — from blog writing to sales prospecting — so you can focus on what matters.
          </p>
          <div className="mb-14">
            <a
              href={BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-lg transition-colors font-medium"
            >
              Arrange an interview →
            </a>
            <p className="text-xs text-slate-400 mt-3">A quick call to see which agents are right for your brand.</p>
          </div>

          {/* Agent cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12 text-left">
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

                  <div className="flex items-center gap-4">
                    <Link
                      href={`/agents/${agent.id}`}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                      </svg>
                      View CV
                    </Link>
                    {agent.status === 'live' && agent.cta && (
                      <a
                        href={BOOKING_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-all group-hover:gap-2.5"
                      >
                        {agent.cta}
                        <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                      </a>
                    )}
                  </div>
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

      {/* How it works */}
      <section id="how-it-works" className="px-6 py-20 bg-slate-50 border-y border-slate-100 scroll-mt-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-sm font-medium text-indigo-600 mb-3 tracking-wide uppercase">How it works</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
              Live in minutes, not months
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: 'Connect your brand',
                body: 'Tell us your website, voice, and audience. Your agents learn what your brand sounds like and who it speaks to.',
              },
              {
                step: '2',
                title: 'Agents do the work',
                body: 'Clem researches keywords and drafts SEO-ready posts. Scout watches competitors and surfaces ranking opportunities — automatically.',
              },
              {
                step: '3',
                title: 'You stay in control',
                body: 'Review, edit, and approve from one dashboard. Publish on a schedule you set, or let your agents queue it for you.',
              },
            ].map((s) => (
              <div key={s.step} className="text-center sm:text-left">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-indigo-600 text-white font-bold text-sm mb-4">
                  {s.step}
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{s.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 py-20 scroll-mt-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-sm font-medium text-indigo-600 mb-3 tracking-wide uppercase">What you get</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
              Everything you need to grow with content
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: '✍️', title: 'SEO blog writing', body: 'Clem researches search intent and drafts publish-ready posts in your brand voice.' },
              { icon: '❓', title: 'FAQ pages with schema', body: 'Build FAQ pages with FAQPage structured data — the kind that earn rich results and get cited by AI answer engines.' },
              { icon: '🛒', title: 'Native Shopify publishing', body: 'Posts and FAQs publish straight into your Shopify blog — properly indexable, no fragile embed widgets.' },
              { icon: '🤖', title: 'AI-search visibility', body: 'Answer-first writing, structured data, and instant IndexNow pings so ChatGPT, Perplexity and Bing surface your content in hours.' },
              { icon: '🔗', title: 'Automatic internal linking', body: 'Every post links to related content and funnels authority to your key pages — built and kept current for you.' },
              { icon: '🔭', title: 'Rank tracking & opportunities', body: 'Scout monitors positions and competitors and surfaces keyword gaps — briefed to Clem in a click.' },
            ].map((f) => (
              <div key={f.title} className="rounded-2xl border border-slate-200 p-6 hover:border-indigo-200 hover:shadow-sm transition-all">
                <div className="text-2xl mb-3">{f.icon}</div>
                <h3 className="text-base font-semibold text-slate-900 mb-1.5">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="px-6 py-20 bg-slate-900">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-4">
            Ready to put your content on autopilot?
          </h2>
          <p className="text-lg text-slate-300 mb-10 max-w-xl mx-auto leading-relaxed">
            Tell us about your brand and we&apos;ll show you what your agents can do. No commitment — just a conversation.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-lg transition-colors font-medium"
            >
              Arrange an interview →
            </a>
            <Link
              href="/sign-in"
              className="w-full sm:w-auto text-sm bg-white/10 hover:bg-white/20 text-white border border-white/20 px-6 py-3 rounded-lg transition-colors font-medium"
            >
              Client sign in
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  )
}
