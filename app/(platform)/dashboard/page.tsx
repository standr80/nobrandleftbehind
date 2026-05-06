import Link from 'next/link'

// Sprint 1 — hardcoded empty state for Designs on Print (tenant #1)
// Sprint 2 will replace this with live Supabase data scoped to the user's org.
const TENANT = {
  name: 'Designs on Print',
  domain: 'designsonprint.com',
  billingTier: 'Starter',
  publishCadence: '2× per week (Tue & Thu, 09:00)',
}

export default function DashboardPage() {
  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-sm text-white/40 mb-1">{TENANT.domain}</p>
          <h1 className="text-2xl font-bold">{TENANT.name}</h1>
        </div>
        <span className="text-xs bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 px-3 py-1 rounded-full">
          {TENANT.billingTier}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        {[
          { label: 'Pending suggestions', value: '—' },
          { label: 'Drafts in review', value: '—' },
          { label: 'Scheduled posts', value: '—' },
          { label: 'Published this month', value: '—' },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="bg-white/5 border border-white/10 rounded-xl p-4"
          >
            <p className="text-2xl font-bold text-white/70">{value}</p>
            <p className="text-xs text-white/40 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Empty state */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-12 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center text-3xl mb-6">
          ✦
        </div>
        <h2 className="text-xl font-semibold mb-2">Clem is ready to go</h2>
        <p className="text-white/40 text-sm max-w-sm mb-8">
          No content yet. Once Clem is connected to{' '}
          <span className="text-white/60">{TENANT.domain}</span>, topic suggestions will appear
          here automatically — or you can trigger one manually.
        </p>

        <div className="flex flex-wrap gap-3 justify-center">
          <button
            disabled
            className="inline-flex items-center gap-2 bg-indigo-600/50 text-indigo-300 px-5 py-2.5 rounded-lg text-sm cursor-not-allowed"
            title="Available in Sprint 2"
          >
            ✦ Generate topics
          </button>
          <Link
            href="/setup"
            className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white px-5 py-2.5 rounded-lg text-sm transition-colors"
          >
            ⚙ Configure tenant
          </Link>
        </div>

        <p className="text-xs text-white/20 mt-6">
          Publish cadence: {TENANT.publishCadence}
        </p>
      </div>
    </div>
  )
}
