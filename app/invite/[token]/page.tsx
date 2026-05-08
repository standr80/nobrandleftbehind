import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import InviteAccept from './InviteAccept'

interface Props {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params
  const { userId } = await auth()

  // If not signed in, redirect to sign-up then back here
  if (!userId) {
    redirect(`/sign-up?redirect_url=/invite/${token}`)
  }

  const db = createAdminClient()

  // Look up the invitation details to show the user what they're accepting
  const { data: invite } = await db
    .from('workspace_invitations')
    .select('id, email, role, accepted_at, expires_at, tenants(name, domain)')
    .eq('token', token)
    .maybeSingle()

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0d1a]">
        <div className="max-w-md w-full mx-auto px-4 text-center">
          <div className="text-4xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold text-white mb-2">Invite not found</h1>
          <p className="text-white/50 mb-6">
            This invite link is invalid or has already been used.
          </p>
          <a
            href="/dashboard"
            className="text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
          >
            Go to dashboard →
          </a>
        </div>
      </div>
    )
  }

  if (invite.accepted_at) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0d1a]">
        <div className="max-w-md w-full mx-auto px-4 text-center">
          <div className="text-4xl mb-4">✓</div>
          <h1 className="text-2xl font-bold text-white mb-2">Already accepted</h1>
          <p className="text-white/50 mb-6">This invite has already been used.</p>
          <a
            href="/dashboard"
            className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            Go to dashboard
          </a>
        </div>
      </div>
    )
  }

  if (new Date(invite.expires_at) < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0d1a]">
        <div className="max-w-md w-full mx-auto px-4 text-center">
          <div className="text-4xl mb-4">⏰</div>
          <h1 className="text-2xl font-bold text-white mb-2">Invite expired</h1>
          <p className="text-white/50 mb-6">
            This invite link expired on{' '}
            {new Date(invite.expires_at).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
            . Please ask the workspace admin to send a new invite.
          </p>
        </div>
      </div>
    )
  }

  const workspace = Array.isArray(invite.tenants) ? invite.tenants[0] : invite.tenants

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0d1a]">
      <InviteAccept
        token={token}
        workspaceName={workspace?.name ?? 'a workspace'}
        workspaceDomain={workspace?.domain ?? ''}
        inviteEmail={invite.email}
        role={invite.role}
      />
    </div>
  )
}
