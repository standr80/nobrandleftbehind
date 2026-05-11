import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import AdminSubNav from './AdminSubNav'

const PLATFORM_ADMIN_ID = process.env.PLATFORM_ADMIN_CLERK_USER_ID

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) return null
  if (userId !== PLATFORM_ADMIN_ID) redirect('/dashboard')

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Platform admin</h1>
        <p className="text-white/40 text-sm">Superadmin access only.</p>
      </div>
      <AdminSubNav />
      {children}
    </div>
  )
}
