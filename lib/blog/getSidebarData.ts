import { createAdminClient } from '@/lib/supabase/admin'

export interface TagCount {
  tag: string
  count: number
}

export interface SidebarData {
  topTags: TagCount[]       // top 8 by frequency, for sidebar
  allTags: TagCount[]       // all tags sorted by frequency, for topics page
  hasMoreTags: boolean      // whether there are more than 8 tags
}

/**
 * Fetches tag frequency data across all published posts for a tenant.
 * Shared by listing, tag, and topics pages so the sidebar is always consistent.
 */
export async function getSidebarData(tenantId: string): Promise<SidebarData> {
  const db = createAdminClient()

  const { data } = await db
    .from('blog_posts')
    .select('tags')
    .eq('tenant_id', tenantId)
    .eq('status', 'published')

  const tagCounts = new Map<string, number>()
  for (const post of data ?? []) {
    for (const tag of post.tags ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }
  }

  const allTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([tag, count]) => ({ tag, count }))

  return {
    allTags,
    topTags: allTags.slice(0, 8),
    hasMoreTags: allTags.length > 8,
  }
}
