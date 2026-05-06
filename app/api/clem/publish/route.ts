import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { runPublish } from '@/lib/clem/publish'

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tenantId, postId } = await request.json()
  if (!tenantId || !postId)
    return NextResponse.json({ error: 'tenantId and postId required' }, { status: 400 })

  await runPublish(tenantId, postId)
  return NextResponse.json({ ok: true })
}
