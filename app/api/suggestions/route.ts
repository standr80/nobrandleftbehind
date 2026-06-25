import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveMutationWorkspace } from '@/lib/workspace/active'

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { proposed_title, rationale, target_keywords, tenantId } = await request.json()
  const workspace = await resolveMutationWorkspace(userId, tenantId)
  if (!workspace) return NextResponse.json({ error: 'No workspace found' }, { status: 404 })

  const db = createAdminClient()

  if (!proposed_title?.trim()) {
    return NextResponse.json({ error: 'proposed_title is required' }, { status: 400 })
  }

  const { data, error } = await db
    .from('suggestions')
    .insert({
      tenant_id: workspace.tenantId,
      proposed_title: proposed_title.trim(),
      rationale: rationale?.trim() || null,
      target_keywords: Array.isArray(target_keywords) ? target_keywords : [],
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, id: data.id })
}
