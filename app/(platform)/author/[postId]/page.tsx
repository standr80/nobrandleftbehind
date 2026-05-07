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

  const { data: member } = await db
    .from('tenant_members')
    .select('id')
    .eq('tenant_id', post.tenant_id)
    .eq('clerk_user_id', userId)
    .maybeSingle()

  if (!member) notFound()

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/author"
          className="text-sm text-white/40 hover:text-white transition-colors inline-flex items-center gap-1"
        >
          ← All posts
        </Link>
      </div>
      <PostReviewClient post={post} />
    </div>
  )
}
