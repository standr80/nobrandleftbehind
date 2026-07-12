import type { Metadata } from 'next'
import Link from 'next/link'
import MarketingNav from '@/components/marketing/MarketingNav'
import MarketingFooter from '@/components/marketing/MarketingFooter'

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
    role: 'Blog & FAQ content agent',
    description:
      'Researches, writes, and queues SEO-ready blog posts and FAQ pages for your website — on a schedule you control.',
    status: 'live' as const,
    href: '/dashboard',
    cta: 'Hire Clem',
    photo: '/agents/clem.jpg' as string | null,
    accent: '#4f46e5', // indigo
  },
  {
    id: 'scout',
    name: 'Scout',
    role: 'SEO & market intelligence agent',
    description:
      'Tracks your rankings, watches competitors, and surfaces keyword opportunities — then briefs Clem in one click.',
    status: 'live' as const,
    href: '/dashboard/scout',
    cta: 'Meet Scout',
    photo: '/agents/scout.jpg' as string | null,
    accent: '#0d9488', // teal
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
  {
    id: 'bailey',
    name: 'Bailey',
    role: 'Image & gallery agent',
    description:
      'Turns your unsorted event photos into optimised, captioned gallery pages built to rank in image and AI search.',
    status: 'soon' as const,
    href: null,
    cta: null,
    photo: null as string | null,
    accent: '#f59e0b', // amber
  },
  {
    id: 'pam',
    name: 'Pam',
    role: 'Personal assistant agent',
    description:
      'Watches your content calendar and freshness and tells you exactly what to publish next — and when.',
    status: 'soon' as const,
    href: null,
    cta: null,
    photo: null as string | null,
    accent: '#8b5cf6', // violet
  },
]

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
          <p className="text-lg text-slate-500 mb-14 max-w-2xl mx-auto leading-relaxed">
            A suite of intelligent agents that handle the time-consuming work of growing your
            brand — from blog writing to sales prospecting — so you can focus on what matters.
          </p>

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
              href="mailto:hello@nobrandleftbehind.com?subject=Book a demo"
              className="w-full sm:w-auto text-sm bg-white hover:bg-slate-100 text-slate-900 px-6 py-3 rounded-lg transition-colors font-medium"
            >
              Book a demo
            </a>
            <Link
              href="/sign-up"
              className="w-full sm:w-auto text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-lg transition-colors font-medium"
            >
              Get started free →
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  )
}
