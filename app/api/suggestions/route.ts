import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()

  const { data: membership } = await db
    .from('tenant_members')
    .select('tenant_id')
    .eq('clerk_user_id', userId)
    .maybeSingle()

  if (!membership) return NextResponse.json({ error: 'No tenant found' }, { status: 404 })

  const { proposed_title, rationale, target_keywords } = await request.json()
  if (!proposed_title?.trim()) {
    return NextResponse.json({ error: 'proposed_title is required' }, { status: 400 })
  }

  const { data, error } = await db
    .from('suggestions')
    .insert({
      tenant_id: membership.tenant_id,
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
