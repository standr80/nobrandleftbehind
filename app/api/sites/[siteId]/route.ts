/**
 * PATCH  /api/sites/[siteId] — update role flags / label { tenantId, is_competitor?, is_reference?, label? }
 * DELETE /api/sites/[siteId] — remove a site { tenantId }
 *
 * Limit enforcement: turning ON a role checks the workspace's limit for that
 * role. Turning a role off (or deleting) is always allowed.
 */

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveMutationWorkspace } from '@/lib/workspace/active'
import { getSiteLimits, getTenantSites, type TenantSite } from '@/lib/sites'

interface Params {
  params: Promise<{ siteId: string }>
}

async function authorize(request: Request) {
  const { userId } = await auth()
  if (!userId) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const body = await request.json().catch(() => ({}))
  const workspace = await resolveMutationWorkspace(userId, body.tenantId)
  if (!workspace) return { error: NextResponse.json({ error: 'Workspace not found or not a member' }, { status: 403 }) }
  if (workspace.role !== 'admin') return { error: NextResponse.json({ error: 'Admin only' }, { status: 403 }) }
  return { workspace, body }
}

export async function PATCH(request: Request, { params }: Params) {
  const result = await authorize(request)
  if ('error' in result) return result.error
  const { workspace, body } = result
  const { siteId } = await params

  const sites = await getTenantSites(workspace.tenantId)
  const site = sites.find((s: TenantSite) => s.id === siteId)
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })

  const nextCompetitor = typeof body.is_competitor === 'boolean' ? body.is_competitor : site.is_competitor
  const nextReference = typeof body.is_reference === 'boolean' ? body.is_reference : site.is_reference
  if (!nextCompetitor && !nextReference) {
    return NextResponse.json({ error: 'A site must keep at least one role — remove it instead' }, { status: 400 })
  }

  const limits = await getSiteLimits(workspace.tenantId)
  if (nextCompetitor && !site.is_competitor) {
    const count = sites.filter((s) => s.is_competitor).length
    if (count >= limits.maxCompetitorSites) {
      return NextResponse.json(
        { error: `Competitor site limit reached (${limits.maxCompetitorSites}). Contact us to increase your plan.` },
        { status: 403 },
      )
    }
  }
  if (nextReference && !site.is_reference) {
    const count = sites.filter((s) => s.is_reference).length
    if (count >= limits.maxReferenceSites) {
      return NextResponse.json(
        { error: `Reference site limit reached (${limits.maxReferenceSites}). Contact us to increase your plan.` },
        { status: 403 },
      )
    }
  }

  const updates: {
    is_competitor: boolean
    is_reference: boolean
    updated_at: string
    label?: string | null
  } = {
    is_competitor: nextCompetitor,
    is_reference: nextReference,
    updated_at: new Date().toISOString(),
  }
  if ('label' in body) {
    updates.label = typeof body.label === 'string' && body.label.trim() ? body.label.trim() : null
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('tenant_sites')
    .update(updates)
    .eq('id', siteId)
    .eq('tenant_id', workspace.tenantId)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ site: data })
}

export async function DELETE(request: Request, { params }: Params) {
  const result = await authorize(request)
  if ('error' in result) return result.error
  const { workspace } = result
  const { siteId } = await params

  const db = createAdminClient()
  const { error } = await db
    .from('tenant_sites')
    .delete()
    .eq('id', siteId)
    .eq('tenant_id', workspace.tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
