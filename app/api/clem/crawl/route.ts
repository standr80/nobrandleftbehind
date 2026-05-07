import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { runCrawl } from '@/lib/clem/suggest'

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tenantId } = await request.json()
  if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 })

  try {
    await runCrawl(tenantId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[/api/clem/crawl]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
