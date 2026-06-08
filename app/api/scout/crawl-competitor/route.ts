/**
 * POST /api/scout/crawl-competitor
 * Crawl a single competitor URL immediately.
 * Returns the resulting snapshot (date, page_count) so the UI can
 * update inline without a full page reload.
 */

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { resolveMutationWorkspace } from '@/lib/workspace/active'
import { createAdminClient } from '@/lib/supabase/admin'
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

  const body = await request.json()

  const workspace = await resolveMutationWorkspace(userId, body?.tenantId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found or not a member' }, { status: 403 })

  const rawUrl = body?.url as string | undefined
  if (!rawUrl?.trim()) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }

  const db = createAdminClient()
  const { data: tenant } = await db.from('tenants').select('domain').eq('id', workspace.tenantId).single()
  if (!tenant?.domain) return NextResponse.json({ error: 'Tenant domain not set' }, { status: 400 })

  const url = normaliseUrl(rawUrl)
  const clientDomain = tenant.domain

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
