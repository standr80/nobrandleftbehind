import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkspace } from '@/lib/workspace/active'

// PATCH /api/tenant — update the active workspace config
export async function PATCH(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getActiveWorkspace(userId)
  if (!workspace) return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
  if (workspace.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const db = createAdminClient()
  const membership = { tenant_id: workspace.tenantId, role: workspace.role }

  const body = await request.json()

  const updates: {
    name?: string
    domain?: string
    logo_url?: string | null
    brand_voice?: string | null
    target_audience?: string | null
    forbidden_words?: string[]
    cms_type?: string | null
    git_repo?: string | null
    git_branch?: string | null
    git_blog_path?: string | null
    publish_cadence?: string | null
    publish_days?: string[] | null
    publish_time?: string | null
    post_cadence_active?: boolean | null
    reference_urls?: string[]
    white_label_domain?: string | null
    blog_theme?: import('@/lib/supabase/types').Json | null
    theme_extract_url?: string | null
  } = {}

  const allowed = [
    'name', 'domain', 'logo_url', 'brand_voice', 'target_audience', 'forbidden_words',
    'cms_type', 'git_repo', 'git_branch', 'git_blog_path',
    'publish_cadence', 'publish_days', 'publish_time', 'post_cadence_active',
    'reference_urls', 'white_label_domain', 'blog_theme', 'theme_extract_url',
  ] as const
  for (const key of allowed) {
    if (key in body) (updates as Record<string, unknown>)[key] = body[key]
  }

  // Fetch current domain before updating so we can detect a change
  const { data: currentTenant } = await db
    .from('tenants')
    .select('domain')
    .eq('id', membership.tenant_id)
    .single()

  const { error } = await db
    .from('tenants')
    .update(updates)
    .eq('id', membership.tenant_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If the domain changed, invalidate the crawl cache so the next suggestion
  // run crawls the new site rather than returning stale data.
  const newDomain = updates.domain?.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const oldDomain = currentTenant?.domain
  if (newDomain && oldDomain && newDomain !== oldDomain) {
    await db
      .from('site_crawl_cache')
      .delete()
      .eq('tenant_id', membership.tenant_id)
  }

  return NextResponse.json({ ok: true })
}

// POST /api/tenant — create a new workspace and link the current user as admin
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()

  const body = await request.json()
  const { name, domain, brand_voice, target_audience, publish_cadence, publish_days, publish_time, cms_type } = body

  if (!name || !domain) return NextResponse.json({ error: 'name and domain are required' }, { status: 400 })

  const { data: tenant, error: tenantErr } = await db
    .from('tenants')
    .insert({ name, domain, brand_voice, target_audience, publish_cadence, publish_days, publish_time, cms_type })
    .select('id')
    .single()

  if (tenantErr) return NextResponse.json({ error: tenantErr.message }, { status: 500 })

  await db.from('tenant_members').insert({
    tenant_id: tenant.id,
    clerk_user_id: userId,
    role: 'admin',
  })

  return NextResponse.json({ ok: true, tenantId: tenant.id })
}
