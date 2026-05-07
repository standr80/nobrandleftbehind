import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface Params {
  params: Promise<{ suggestionId: string }>
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
