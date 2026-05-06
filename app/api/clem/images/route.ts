import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { runImageSearch } from '@/lib/clem/images'

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tenantId, postId } = await request.json()
  if (!tenantId || !postId)
    return NextResponse.json({ error: 'tenantId and postId required' }, { status: 400 })

  await runImageSearch(tenantId, postId)
  return NextResponse.json({ ok: true })
}
