import { createAdminClient } from '@/lib/supabase/admin'
import { type BlogTenant, type BlogTheme, DEFAULT_BLOG_THEME } from './types'

/**
 * Looks up a tenant whose white_label_domain matches the incoming blog host.
 * Returns null if no tenant is configured for this host.
 * Used by all app/blog/* server components.
 */
export async function getTenantByBlogHost(host: string): Promise<BlogTenant | null> {
  if (!host) return null

  // Strip port (e.g. localhost:3000)
  const cleanHost = host.split(':')[0]

  const db = createAdminClient()

  const { data, error } = await db
    .from('tenants')
    .select('id, name, domain, white_label_domain, blog_theme')
    .eq('white_label_domain', cleanHost)
    .maybeSingle()

  if (error || !data) return null

  // Merge extracted theme with defaults so pages always have complete values
  const rawTheme = data.blog_theme as Partial<BlogTheme> | null
  const theme: BlogTheme = rawTheme
    ? { ...DEFAULT_BLOG_THEME, ...rawTheme }
    : DEFAULT_BLOG_THEME

  return {
    id: data.id,
    name: data.name,
    domain: data.domain,
    white_label_domain: data.white_label_domain,
    blog_theme: theme,
  }
}

/** Posts per page on listing / tag pages */
export const POSTS_PER_PAGE = 10
