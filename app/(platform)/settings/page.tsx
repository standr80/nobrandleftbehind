import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkspace } from '@/lib/workspace/active'
import SettingsForm from './SettingsForm'
import type { ReferenceSummary } from '@/lib/clem/suggest'
import type { BlogTheme } from '@/lib/blog/types'
import { getSiteLimits, getTenantSites } from '@/lib/sites'

export default async function SettingsPage() {
  const { userId } = await auth()
  if (!userId) return null

  const workspace = await getActiveWorkspace(userId)

  if (!workspace) redirect('/setup')

  const { tenant, role } = workspace
  const db = createAdminClient()

  const [{ data: members }, { data: crawlCache }, sites, siteLimits] = await Promise.all([
    db
      .from('tenant_members')
      .select('id, name, email, role, clerk_user_id, created_at')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: true }),
    db
      .from('site_crawl_cache')
      .select('crawled_at, reference_summaries')
      .eq('tenant_id', tenant.id)
      .maybeSingle(),
    getTenantSites(tenant.id),
    getSiteLimits(tenant.id),
  ])

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Settings</h1>
        <p className="text-slate-400 text-sm">{tenant.name} · {tenant.domain}</p>
      </div>

      <Link
        href="/settings/authors"
        className="flex items-center justify-between border border-slate-200 rounded-xl px-4 py-3 mb-8 hover:border-indigo-300 transition-colors"
      >
        <div>
          <p className="font-semibold text-slate-900 text-sm">Authors</p>
          <p className="text-slate-400 text-xs">Manage named authors &amp; bios for article attribution (E-E-A-T)</p>
        </div>
        <span className="text-slate-400">→</span>
      </Link>
      <SettingsForm
        key={tenant.id}
        tenant={{
          ...tenant,
          blog_theme: tenant.blog_theme as unknown as BlogTheme | null,
          theme_extract_url: tenant.theme_extract_url ?? null,
          blog_footer: tenant.blog_footer ?? null,
          ideogram_api_key: (tenant as unknown as { ideogram_api_key: string | null }).ideogram_api_key ?? null,
          image_gen_enabled: (tenant as unknown as { image_gen_enabled: boolean | null }).image_gen_enabled ?? null,
          deploy_hook_url: (tenant as unknown as { deploy_hook_url: string | null }).deploy_hook_url ?? null,
          internal_links: (tenant as unknown as { internal_links: { url: string; label?: string; description?: string; must_link?: boolean }[] | null }).internal_links ?? null,
          shopify_shop_domain: (tenant as unknown as { shopify_shop_domain: string | null }).shopify_shop_domain ?? null,
          shopify_client_id: (tenant as unknown as { shopify_client_id: string | null }).shopify_client_id ?? null,
          shopify_client_secret: (tenant as unknown as { shopify_client_secret: string | null }).shopify_client_secret ?? null,
          shopify_access_token: (tenant as unknown as { shopify_access_token: string | null }).shopify_access_token ?? null,
          shopify_blog_id: (tenant as unknown as { shopify_blog_id: string | null }).shopify_blog_id ?? null,
          shopify_faq_blog_id: (tenant as unknown as { shopify_faq_blog_id: string | null }).shopify_faq_blog_id ?? null,
          shopify_api_version: (tenant as unknown as { shopify_api_version: string | null }).shopify_api_version ?? null,
          indexnow_key: (tenant as unknown as { indexnow_key: string | null }).indexnow_key ?? null,
          indexnow_key_location: (tenant as unknown as { indexnow_key_location: string | null }).indexnow_key_location ?? null,
          content_clusters: (tenant as unknown as { content_clusters: { name: string; money_url: string; money_label?: string; keywords?: string[] }[] | null }).content_clusters ?? null,
          shopify_store_url: (tenant as unknown as { shopify_store_url: string | null }).shopify_store_url ?? null,
        }}
        members={members ?? []}
        isAdmin={role === 'admin'}
        crawledAt={crawlCache?.crawled_at ?? null}
        referenceSummaries={(crawlCache?.reference_summaries as unknown as ReferenceSummary[]) ?? []}
        sites={sites}
        siteLimits={siteLimits}
      />
    </div>
  )
}
