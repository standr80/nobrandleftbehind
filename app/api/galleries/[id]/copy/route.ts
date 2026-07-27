import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { aiErrorResponse } from '@/lib/anthropic'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveMutationWorkspace } from '@/lib/workspace/active'
import { getGallery } from '@/lib/bailey/galleries'
import { generateGalleryCopy } from '@/lib/bailey/copy'

export const maxDuration = 60

interface Params {
  params: Promise<{ id: string }>
}

// POST — Clem writes the gallery page copy (intro + meta description + tags
// + cluster classification) from the title, context and image captions.
// Body: { tenantId }. Output is a DRAFT — user-editable before publish.
export async function POST(request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const workspace = await resolveMutationWorkspace(userId, body.tenantId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const gallery = await getGallery(id, workspace.tenantId)
  if (!gallery) return NextResponse.json({ error: 'Gallery not found' }, { status: 404 })

  try {
    const copy = await generateGalleryCopy(gallery, workspace.tenantId)
    const db = createAdminClient()
    const { error } = await db
      .from('blog_posts')
      .update({
        body_mdx: copy.body_mdx,
        meta_description: copy.meta_description || null,
        tags: copy.tags.length ? copy.tags : null,
        cluster_id: copy.cluster_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', gallery.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, ...copy })
  } catch (err) {
    const { error, status } = aiErrorResponse(err)
    return NextResponse.json({ error }, { status })
  }
}
