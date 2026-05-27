/**
 * POST /api/scout/crawl-competitor
 * Crawl a single competitor URL immediately.
 * Returns the resulting snapshot (date, page_count) so the UI can
 * update inline without a full page reload.
 */

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getActiveWorkspace } from '@/lib/workspace/active'
import { runCompetitorPipeline } from '@/lib/scout/pipelines/competitors'

export const maxDuration = 120

function normaliseUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return 'https://' + trimmed
}

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getActiveWorkspace(userId)
  if (!workspace) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

  const body = await request.json()
  const rawUrl = body?.url as string | undefined
  if (!rawUrl?.trim()) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }

  const url = normaliseUrl(rawUrl)
  const clientDomain = workspace.tenant.domain

  try {
    const results = await runCompetitorPipeline(workspace.tenantId, clientDomain, [url])
    const result = results[0]

    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      competitorUrl: result?.competitorUrl ?? url,
      snapshot_date: new Date().toISOString().slice(0, 10),
      page_count: result?.newPages?.length ?? null,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Crawl failed' },
      { status: 500 },
    )
  }
}
