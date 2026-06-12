/**
 * GET  /api/sites?tenantId=…  — list sites + limits for a workspace
 * POST /api/sites             — add a site { tenantId, url, is_competitor?, is_reference?, label? }
 *
 * Per-workspace limits (tenants.max_competitor_sites / max_reference_sites,
 * superadmin-set) are enforced HERE, server-side — the UI only mirrors them.
 */

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveMutationWorkspace } from '@/lib/workspace/active'
import { getSiteLimits, getTenantSites, normalizeSiteUrl } from '@/lib/sites'

export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = new URL(request.url).searchParams.get('tenantId')
  const workspace = await resolveMutationWorkspace(userId, tenantId ?? undefined)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found or not a member' }, { status: 403 })

  const [sites, limits] = await Promise.all([
    getTenantSites(workspace.tenantId),
    getSiteLimits(workspace.tenantId),
  ])
  return NextResponse.json({ sites, limits })
}

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const workspace = await resolveMutationWorkspace(userId, body.tenantId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found or not a member' }, { status: 403 })
  if (workspace.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const url = normalizeSiteUrl(String(body.url ?? ''))
  if (!url || !url.includes('.')) {
    return NextResponse.json({ error: 'A valid URL is required' }, { status: 400 })
  }
  const isCompetitor = body.is_competitor !== false // default true
  const isReference = body.is_reference === true
  if (!isCompetitor && !isReference) {
    return NextResponse.json({ error: 'A site must be a competitor, a reference, or both' }, { status: 400 })
  }

  const [sites, limits] = await Promise.all([
    getTenantSites(workspace.tenantId),
    getSiteLimits(workspace.tenantId),
  ])

  if (sites.some((s) => s.url === url)) {
    return NextResponse.json({ error: 'That site is already in your list' }, { status: 409 })
  }

  const competitorCount = sites.filter((s) => s.is_competitor).length
  const referenceCount = sites.filter((s) => s.is_reference).length
  if (isCompetitor && competitorCount >= limits.maxCompetitorSites) {
    return NextResponse.json(
      { error: `Competitor site limit reached (${limits.maxCompetitorSites}). Contact us to increase your plan.` },
      { status: 403 },
    )
  }
  if (isReference && referenceCount >= limits.maxReferenceSites) {
    return NextResponse.json(
      { error: `Reference site limit reached (${limits.maxReferenceSites}). Contact us to increase your plan.` },
      { status: 403 },
    )
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('tenant_sites')
    .insert({
      tenant_id: workspace.tenantId,
      url,
      is_competitor: isCompetitor,
      is_reference: isReference,
      label: typeof body.label === 'string' && body.label.trim() ? body.label.trim() : null,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ site: data })
}
