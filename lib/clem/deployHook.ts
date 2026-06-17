import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Fire a tenant's Vercel Deploy Hook (if configured) so its prerendered static
 * site rebuilds and picks up newly published / changed / removed posts.
 *
 * Fire-and-forget: any failure is logged but never thrown, so a flaky hook can
 * never break the publish action itself.
 */
export async function triggerDeployHook(tenantId: string): Promise<void> {
  try {
    const db = createAdminClient()
    const { data } = await db
      .from('tenants')
      .select('deploy_hook_url')
      .eq('id', tenantId)
      .maybeSingle()

    const url = (data as { deploy_hook_url?: string | null } | null)?.deploy_hook_url
    if (!url) return

    await fetch(url, { method: 'POST' })
    console.log(`[deployHook] triggered rebuild for tenant ${tenantId}`)
  } catch (e) {
    console.error(`[deployHook] failed to trigger for tenant ${tenantId}:`, e)
  }
}
