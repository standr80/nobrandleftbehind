/**
 * GET /api/scout/config  — fetch scout config for current tenant
 * PATCH /api/scout/config — update scout config
 */

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkspace, resolveMutationWorkspace } from '@/lib/workspace/active'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getActiveWorkspace(userId)
  if (!workspace) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

  const db = createAdminClient()
  const { data, error } = await db
    .from('scout_config')
    .select('*')
    .eq('tenant_id', workspace.tenantId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-create if missing
  if (!data) {
    const { data: created, error: createError } = await db
      .from('scout_config')
      .insert({ tenant_id: workspace.tenantId })
      .select('*')
      .single()
    if (createError) return NextResponse.json({ error: createError.message }, { status: 500 })
    return NextResponse.json(created)
  }

  return NextResponse.json(data)
}

export async function PATCH(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  // Target the workspace the page was loaded with (explicit tenantId), verified
  // against membership — not the shared active-workspace cookie.
  const workspace = await resolveMutationWorkspace(userId, body.tenantId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found or not a member' }, { status: 403 })

  const allowed = [
    'enabled', 'auto_run_enabled', 'briefing_day', 'briefing_time', 'competitor_urls', 'dataforseo_enabled',
    'track_competitors', 'track_keywords', 'track_rankings', 'rank_alert_threshold',
    'location_code', 'rank_location_codes', 'brand_terms', 'rank_devices',
  ]
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }
  updates.updated_at = new Date().toISOString()

  const db = createAdminClient()

  // Upsert in case row doesn't exist yet
  const { data, error } = await db
    .from('scout_config')
    .upsert({ tenant_id: workspace.tenantId, ...updates }, { onConflict: 'tenant_id' })
    // (tenant_id from verified membership; body.tenantId is not a config column)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
