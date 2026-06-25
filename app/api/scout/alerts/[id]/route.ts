/**
 * PATCH /api/scout/alerts/[id]
 * Dismiss an alert by marking it actioned=true.
 */

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveMutationWorkspace } from '@/lib/workspace/active'

interface Props {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, { params }: Props) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const requestedTenantId = new URL(request.url).searchParams.get('tenantId')
  const workspace = await resolveMutationWorkspace(userId, requestedTenantId)
  if (!workspace) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

  const db = createAdminClient()
  const { error } = await db
    .from('scout_alerts')
    .update({ actioned: true, actioned_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', workspace.tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
