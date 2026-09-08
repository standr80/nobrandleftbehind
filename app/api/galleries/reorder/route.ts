import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveMutationWorkspace } from '@/lib/workspace/active'
import { triggerDeployHook } from '@/lib/clem/deployHook'

/**
 * POST — set the display order of a workspace's galleries.
 * Body: { tenantId, ids: string[] } — ids in the order they should appear.
 *
 * The whole list is sent rather than a single move, so positions are always
 * rewritten from a consistent snapshot. Two people reordering at once end up
 * with one of the two orders, not an interleaved mess.
 */
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const workspace = await resolveMutationWorkspace(userId, body.tenantId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const ids: unknown = body.ids
  if (!Array.isArray(ids) || !ids.length || !ids.every((i) => typeof i === 'string')) {
    return NextResponse.json({ error: 'ids must be a non-empty array of gallery ids' }, { status: 400 })
  }

  const db = createAdminClient()

  // Only reorder galleries this workspace actually owns — an id from another
  // tenant must not be writable through this route.
  const { data: owned, error: ownErr } = await db
    .from('blog_posts')
    .select('id')
    .eq('tenant_id', workspace.tenantId)
    .eq('content_type', 'gallery')
    .is('deleted_at', null)
    .in('id', ids as string[])
  if (ownErr) return NextResponse.json({ error: ownErr.message }, { status: 500 })

  const ownedIds = new Set((owned ?? []).map((r) => (r as { id: string }).id))
  const toWrite = (ids as string[]).filter((id) => ownedIds.has(id))
  if (!toWrite.length) {
    return NextResponse.json({ error: 'No matching galleries' }, { status: 404 })
  }

  for (let i = 0; i < toWrite.length; i++) {
    const { error } = await db
      .from('blog_posts')
      .update({ gallery_display_order: i })
      .eq('id', toWrite[i])
      .eq('tenant_id', workspace.tenantId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Order is published content: purge the tenant's cached API responses and
  // rebuild, or the new order sits invisible behind the edge cache.
  await triggerDeployHook(workspace.tenantId)

  return NextResponse.json({ ok: true, ordered: toWrite.length })
}
