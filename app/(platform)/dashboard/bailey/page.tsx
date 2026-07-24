import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkspace } from '@/lib/workspace/active'
import BaileyGalleries from '@/components/bailey/BaileyGalleries'
import type { GalleryImage } from '@/lib/bailey/constants'

export default async function BaileyPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const workspace = await getActiveWorkspace(userId)
  if (!workspace) redirect('/setup')

  const db = createAdminClient()
  const { data } = await db
    .from('blog_posts')
    .select('id, title, slug, status, gallery_images, gallery_context, created_at')
    .eq('tenant_id', workspace.tenantId)
    .eq('content_type', 'gallery')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const galleries = (data ?? []).map((g) => {
    const images = Array.isArray(g.gallery_images) ? (g.gallery_images as unknown as GalleryImage[]) : []
    return {
      id: g.id,
      title: g.title,
      status: g.status,
      context: g.gallery_context,
      imageCount: images.length,
      readyCount: images.filter((i) => i.status === 'ready').length,
      failedCount: images.filter((i) => i.status === 'failed').length,
      created_at: g.created_at,
    }
  })

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 mb-2">Bailey — image galleries</h1>
      <p className="text-sm text-slate-500 mb-6">
        Drop your event and product photos and Bailey does the rest: optimised images, AI alt
        text and captions, page copy from Clem, and a schema-rich gallery page published to
        your site. Nothing goes live until you review and approve it.
      </p>
      <BaileyGalleries key={workspace.tenantId} initialGalleries={galleries} tenantId={workspace.tenantId} />
    </div>
  )
}
