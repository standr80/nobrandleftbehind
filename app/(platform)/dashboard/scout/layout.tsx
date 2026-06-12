import { auth } from '@clerk/nextjs/server'
import { getActiveWorkspace } from '@/lib/workspace/active'
import ScoutSubNav from '@/components/scout/ScoutSubNav'

export default async function ScoutLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  const workspace = userId ? await getActiveWorkspace(userId) : null

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-emerald-600 uppercase tracking-widest">Scout</span>
          <span className="text-xs text-slate-400">
            Market Intelligence
            {workspace && <> · {workspace.tenant.name} · {workspace.tenant.domain}</>}
          </span>
        </div>
        <ScoutSubNav />
      </div>
      {children}
    </div>
  )
}
