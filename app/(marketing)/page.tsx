import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Nav */}
      <nav className="border-b border-white/10 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto w-full">
        <span className="text-xl font-semibold tracking-tight">
          <span className="text-indigo-400">Clem</span>
          <span className="text-white/40 text-sm ml-2">by nobrandleftbehind</span>
        </span>
        <div className="flex items-center gap-4">
          <Link href="/sign-in" className="text-sm text-white/60 hover:text-white transition-colors">
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex items-center justify-center px-6 py-24 text-center">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-1.5 text-sm text-indigo-300 mb-8">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            Sprint 1 — Foundation
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-6 bg-gradient-to-br from-white to-white/50 bg-clip-text text-transparent">
            Your AI blog writer, fully autonomous.
          </h1>
          <p className="text-lg text-white/50 mb-10 max-w-xl mx-auto">
            Clem researches, writes, and publishes SEO-ready blog posts for your clients — via
            GitHub PR, on a schedule you control.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3.5 rounded-xl font-medium transition-colors text-lg"
          >
            Open dashboard
          </Link>
        </div>
      </section>
    </main>
  )
}
