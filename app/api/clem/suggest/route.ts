import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { runSuggestions } from '@/lib/clem/suggest'

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tenantId } = await request.json()
  if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 })

  await runSuggestions(tenantId)
  return NextResponse.json({ ok: true })
}
