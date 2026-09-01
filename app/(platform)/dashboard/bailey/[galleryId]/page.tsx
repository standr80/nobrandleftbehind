import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActiveWorkspace } from '@/lib/workspace/active'
import { getGallery, galleryImages } from '@/lib/bailey/galleries'
import { galleryPublicUrl } from '@/lib/bailey/constants'
import { publicPostUrl } from '@/lib/content/api'
import GalleryUploader from '@/components/bailey/GalleryUploader'
import GalleryCopyPanel from '@/components/bailey/GalleryCopyPanel'
import GalleryDetailsPanel from '@/components/bailey/GalleryDetailsPanel'

interface Props {
  params: Promise<{ galleryId: string }>
}

export default async function GalleryPage({ params }: Props) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const workspace = await getActiveWorkspace(userId)
  if (!workspace) redirect('/setup')

  const { galleryId } = await params
  const gallery = await getGallery(galleryId, workspace.tenantId)

  // Graceful miss: the gallery doesn't exist, was deleted, or belongs to a
  // different workspace (e.g. the user switched workspace while viewing it).
  if (!gallery) {
    return (
      <div className="max-w-md">
        <h1 className="text-xl font-bold text-slate-900 mb-2">Gallery not available</h1>
        <p className="text-sm text-slate-500 mb-6">
          This gallery isn&apos;t part of the <span className="font-medium text-slate-700">{workspace.tenant.name}</span> workspace
          — it may belong to a different workspace, or it&apos;s been deleted. If you just switched
          workspace, switch back to see it again.
        </p>
        <Link
          href="/dashboard/bailey"
          className="inline-block px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors"
        >
          View this workspace&apos;s galleries
        </Link>
      </div>
    )
  }

  // Where the published gallery can be viewed. Shopify tenants get the article
  // URL stored at push time; everyone else publishes straight to the Content
  // API, where there is no stored URL — so derive it from the tenant's domain,
  // using the same helper the API uses, so the two never drift apart.
  const publishedUrl =
    gallery.shopify_article_url ??
    (gallery.status === 'published' && workspace.tenant.domain
      ? publicPostUrl(workspace.tenant.domain, gallery.slug, 'gallery')
      : null)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const images = galleryImages(gallery).map((img) => ({
    ...img,
    preview_url: img.thumb_url ?? img.url ?? galleryPublicUrl(supabaseUrl, img.storage_path),
  }))

  return (
    <div>
      <Link href="/dashboard/bailey" className="text-sm text-slate-500 hover:text-slate-700">
        ← All galleries
      </Link>
      <h1 className="text-xl font-bold text-slate-900 mt-2 mb-1">{gallery.title}</h1>
      {gallery.gallery_context && (
        <p className="text-sm text-slate-500 mb-1">Context: {gallery.gallery_context}</p>
      )}
      <p className="text-sm text-slate-500 mb-3">
        Drop images below — up to 50 per gallery, 10MB each (jpg, png, webp).
      </p>
      <GalleryDetailsPanel
        key={`details-${gallery.id}`}
        tenantId={workspace.tenantId}
        galleryId={gallery.id}
        initialTitle={gallery.title}
        initialSlug={gallery.slug}
        initialContext={gallery.gallery_context}
        isPublished={gallery.status === 'published'}
      />
      <GalleryCopyPanel
        key={`copy-${gallery.id}`}
        tenantId={workspace.tenantId}
        galleryId={gallery.id}
        initialIntro={gallery.body_mdx}
        initialMeta={gallery.meta_description}
        initialTags={gallery.tags}
        initialClusterId={gallery.cluster_id}
        isPublished={gallery.status === 'published'}
      />
      <GalleryUploader
        key={gallery.id}
        tenantId={workspace.tenantId}
        galleryId={gallery.id}
        galleryTitle={gallery.title}
        galleryContext={gallery.gallery_context}
        galleryStatus={gallery.status}
        publishedUrl={publishedUrl}
        consentAttested={Boolean(gallery.consent_attested_at)}
        initialImages={images}
      />
    </div>
  )
}
