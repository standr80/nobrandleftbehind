import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveMutationWorkspace } from '@/lib/workspace/active'

// PATCH /api/tenant — update a workspace config.
// The target workspace comes from the explicit `tenantId` in the body (the
// workspace the page was loaded with), verified against membership — NOT from
// the shared active-workspace cookie, which a second browser tab can change
// underneath, causing cross-workspace overwrites.
export async function PATCH(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  const workspace = await resolveMutationWorkspace(userId, body.tenantId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found or not a member' }, { status: 403 })
  if (workspace.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const db = createAdminClient()
  const membership = { tenant_id: workspace.tenantId, role: workspace.role }

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
    white_label_domain?: string | null
    blog_theme?: import('@/lib/supabase/types').Json | null
    theme_extract_url?: string | null
    blog_footer?: string | null
    ideogram_api_key?: string | null
    image_gen_enabled?: boolean | null
    deploy_hook_url?: string | null
    internal_links?: import('@/lib/supabase/types').Json | null
    shopify_shop_domain?: string | null
    shopify_client_id?: string | null
    shopify_client_secret?: string | null
    shopify_access_token?: string | null
    shopify_blog_id?: string | null
    shopify_faq_blog_id?: string | null
    shopify_api_version?: string | null
    shopify_store_url?: string | null
    indexnow_key?: string | null
    indexnow_key_location?: string | null
  } = {}

  const allowed = [
    'name', 'domain', 'logo_url', 'brand_voice', 'target_audience', 'forbidden_words',
    'cms_type', 'git_repo', 'git_branch', 'git_blog_path',
    'publish_cadence', 'publish_days', 'publish_time', 'post_cadence_active',
    'white_label_domain', 'blog_theme', 'theme_extract_url', 'blog_footer',
    'ideogram_api_key', 'image_gen_enabled', 'deploy_hook_url', 'internal_links',
    'shopify_shop_domain', 'shopify_client_id', 'shopify_client_secret',
    'shopify_access_token', 'shopify_blog_id', 'shopify_faq_blog_id',
    'shopify_api_version', 'shopify_store_url',
    'indexnow_key', 'indexnow_key_location',
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
