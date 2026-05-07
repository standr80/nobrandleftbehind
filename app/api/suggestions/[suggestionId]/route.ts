import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface Params {
  params: Promise<{ suggestionId: string }>
}

export async function PATCH(request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { suggestionId } = await params
  const db = createAdminClient()

  const { data: suggestion } = await db
    .from('suggestions')
    .select('tenant_id')
    .eq('id', suggestionId)
    .single()

  if (!suggestion) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: member } = await db
    .from('tenant_members')
    .select('id')
    .eq('tenant_id', suggestion.tenant_id)
    .eq('clerk_user_id', userId)
    .maybeSingle()

  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { proposed_title, rationale, target_keywords } = await request.json()
  const updates: { proposed_title?: string; rationale?: string | null; target_keywords?: string[] | null } = {}
  if (proposed_title !== undefined) updates.proposed_title = proposed_title
  if (rationale !== undefined) updates.rationale = rationale
  if (target_keywords !== undefined) updates.target_keywords = target_keywords

  const { error } = await db.from('suggestions').update(updates).eq('id', suggestionId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { suggestionId } = await params
  const db = createAdminClient()

  const { data: suggestion } = await db
    .from('suggestions')
    .select('tenant_id')
    .eq('id', suggestionId)
    .single()

  if (!suggestion) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: member } = await db
    .from('tenant_members')
    .select('id')
    .eq('tenant_id', suggestion.tenant_id)
    .eq('clerk_user_id', userId)
    .maybeSingle()

  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await db.from('suggestions').update({ status: 'rejected' }).eq('id', suggestionId)

  return NextResponse.json({ ok: true })
}
