import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import DashboardNav from '@/components/layout/DashboardNav'

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  return (
    <div className="min-h-screen bg-gray-950 text-white flex">
      <DashboardNav />
      <main className="flex-1 min-w-0 p-8">{children}</main>
    </div>
  )
}
