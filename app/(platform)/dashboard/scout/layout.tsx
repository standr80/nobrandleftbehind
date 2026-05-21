import ScoutSubNav from '@/components/scout/ScoutSubNav'

export default function ScoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-indigo-400 uppercase tracking-widest">Scout</span>
          <span className="text-xs text-slate-400">Market Intelligence</span>
        </div>
        <ScoutSubNav />
      </div>
      {children}
    </div>
  )
}
