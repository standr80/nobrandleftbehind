import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import PostReviewClient from '@/components/posts/PostReviewClient'
import Link from 'next/link'

interface Props {
  params: Promise<{ postId: string }>
}

export default async function PostReviewPage({ params }: Props) {
  const { postId } = await params
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const db = createAdminClient()

  // Verify the user belongs to this post's tenant
  const { data: post } = await db
    .from('blog_posts')
    .select('*')
    .eq('id', postId)
    .single()

  if (!post) notFound()

  const [{ data: member }, { data: tenant }] = await Promise.all([
    db.from('tenant_members').select('id')
      .eq('tenant_id', post.tenant_id).eq('clerk_user_id', userId).maybeSingle(),
    db.from('tenants').select('image_gen_enabled')
      .eq('id', post.tenant_id).single(),
  ])

  if (!member) notFound()

  const imageGenEnabled = (tenant as { image_gen_enabled: boolean | null } | null)?.image_gen_enabled ?? false

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/author"
          className="text-sm text-slate-400 hover:text-slate-900 transition-colors inline-flex items-center gap-1"
        >
          ← All posts
        </Link>
      </div>
      <PostReviewClient post={post} tenantId={post.tenant_id} imageGenEnabled={imageGenEnabled} />
    </div>
  )
}
