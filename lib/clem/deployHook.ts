import { revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { contentTag } from '@/lib/content/api'

/**
 * Purge a tenant's cached public Content API responses (list, single post,
 * tags, theme) from Vercel's edge cache. Those responses carry a matching
 * `Cache-Tag: content-<tenantId>` header, so revalidating the tag evicts them
 * immediately — otherwise a just-published post can stay invisible for the
 * PUBLIC_CACHE window (and a stale "not found" could be baked into a rebuild).
 *
 * Best-effort: never throws, so a purge hiccup can't break the publish action.
 */
export function purgeTenantContentCache(tenantId: string): void {
  try {
    revalidateTag(contentTag(tenantId))
    console.log(`[deployHook] purged content cache for tenant ${tenantId}`)
  } catch (e) {
    console.error(`[deployHook] cache purge failed for tenant ${tenantId}:`, e)
  }
}

/**
 * Fire a tenant's Vercel Deploy Hook (if configured) so its prerendered static
 * site rebuilds and picks up newly published / changed / removed posts.
 *
 * Fire-and-forget: any failure is logged but never thrown, so a flaky hook can
 * never break the publish action itself.
 */
export async function triggerDeployHook(tenantId: string): Promise<void> {
  // Evict the tenant's cached API responses BEFORE rebuilding, so the rebuild
  // (and any live embed consumer) re-fetches fresh data instead of a stale copy.
  purgeTenantContentCache(tenantId)

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
