import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export const ACTIVE_WORKSPACE_COOKIE = 'clem_active_workspace'
export const PENDING_INVITE_COOKIE = 'clem_pending_invite'

export interface ActiveWorkspace {
  tenantId: string
  role: string
  tenant: {
    id: string
    name: string
    domain: string
    billing_tier: string | null
    publish_cadence: string | null
    publish_days: string[] | null
    publish_time: string | null
    brand_voice: string | null
    target_audience: string | null
    forbidden_words: string[] | null
    cms_type: string | null
    git_repo: string | null
    git_branch: string | null
    git_blog_path: string | null
    logo_url: string | null
    post_cadence_active: boolean | null
    reference_urls: string[] | null
    white_label_domain: string | null
    blog_theme: import('../supabase/types').Json | null
    theme_extract_url: string | null
    blog_footer: string | null
    image_gen_enabled: boolean | null
  }
}

/**
 * Returns the active workspace for a user.
 * Priority: valid cookie → first membership.
 * Validates that the cookie value actually belongs to this user.
 */
export async function getActiveWorkspace(userId: string): Promise<ActiveWorkspace | null> {
  const db = createAdminClient()

  // Fetch all memberships for this user
  const { data: memberships } = await db
    .from('tenant_members')
    .select('tenant_id, role, tenants(*)')
    .eq('clerk_user_id', userId)
    .order('created_at', { ascending: true })

  if (!memberships?.length) return null

  // Try to honour the cookie
  const cookieStore = await cookies()
  const cookieVal = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value

  let active = cookieVal
    ? memberships.find((m) => m.tenant_id === cookieVal)
    : null

  // Fall back to first membership
  if (!active) active = memberships[0]

  const tenant = Array.isArray(active.tenants) ? active.tenants[0] : active.tenants
  if (!tenant) return null

  return {
    tenantId: active.tenant_id,
    role: active.role,
    tenant: tenant as ActiveWorkspace['tenant'],
  }
}

/**
 * Returns ALL workspaces the user is a member of (for the switcher).
 */
export async function getAllWorkspaces(userId: string) {
  const db = createAdminClient()
  const { data } = await db
    .from('tenant_members')
    .select('tenant_id, role, tenants(id, name, domain, logo_url, billing_tier)')
    .eq('clerk_user_id', userId)
    .order('created_at', { ascending: true })

  return (data ?? []).map((m) => {
    const t = Array.isArray(m.tenants) ? m.tenants[0] : m.tenants
    return { tenantId: m.tenant_id, role: m.role, tenant: t }
  })
}
