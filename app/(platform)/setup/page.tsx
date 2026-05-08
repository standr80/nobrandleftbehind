import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getActiveWorkspace } from '@/lib/workspace/active'
import SetupWizard from './SetupWizard'

export default async function SetupPage() {
  const { userId } = await auth()
  if (!userId) return null

  const workspace = await getActiveWorkspace(userId)

  // Already has a workspace — redirect to settings
  if (workspace) redirect('/settings')

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Set up your workspace</h1>
        <p className="text-white/40 text-sm">
          Tell Clem about your website so it can write content that sounds like you.
        </p>
      </div>
      <SetupWizard />
    </div>
  )
}
