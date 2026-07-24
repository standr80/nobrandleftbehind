import { auth } from '@clerk/nextjs/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getActiveWorkspace } from '@/lib/workspace/active'
import { getGallery, galleryImages } from '@/lib/bailey/galleries'
import { galleryPublicUrl } from '@/lib/bailey/constants'
import GalleryUploader from '@/components/bailey/GalleryUploader'

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
  if (!gallery) notFound()

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
      <p className="text-sm text-slate-500 mb-6">
        Drop images below — up to 50 per gallery, 10MB each (jpg, png, webp).
      </p>
      <GalleryUploader
        key={gallery.id}
        tenantId={workspace.tenantId}
        galleryId={gallery.id}
        initialImages={images}
      />
    </div>
  )
}
