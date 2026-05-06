import { createApi } from 'unsplash-js'
import { createAdminClient } from '../supabase/admin'
import type { Json } from '../supabase/types'

const unsplash = createApi({
  accessKey: process.env.UNSPLASH_ACCESS_KEY!,
})

export interface ImageCandidate {
  url: string
  thumb_url: string
  photographer_name: string
  photographer_url: string
  alt_text: string
  unsplash_id: string
}

// ============================================================
// Public: search Unsplash for hero image candidates
// Stores 5 candidates as jsonb on blog_posts.image_suggestions
// ============================================================

export async function runImageSearch(tenantId: string, postId: string): Promise<void> {
  const db = createAdminClient()

  const { data: post, error: postErr } = await db
    .from('blog_posts')
    .select('title, tags, tenant_id')
    .eq('id', postId)
    .eq('tenant_id', tenantId)
    .single()

  if (postErr || !post) throw new Error(`Post ${postId} not found`)

  // Build a search query from post title + first tag
  const searchQuery = [post.title, post.tags?.[0]].filter(Boolean).join(' ')

  console.log(`[clem/images] Searching Unsplash for "${searchQuery}"…`)

  const result = await unsplash.search.getPhotos({
    query: searchQuery,
    perPage: 5,
    orientation: 'landscape',
  })

  if (result.type === 'error') {
    throw new Error(`Unsplash search failed: ${result.errors.join(', ')}`)
  }

  const candidates: ImageCandidate[] = result.response.results.map((photo) => ({
    unsplash_id: photo.id,
    url: photo.urls.regular,
    thumb_url: photo.urls.thumb,
    alt_text: photo.alt_description ?? photo.description ?? post.title,
    photographer_name: photo.user.name,
    photographer_url: `https://unsplash.com/@${photo.user.username}?utm_source=clem&utm_medium=referral`,
  }))

  const { error: updateError } = await db
    .from('blog_posts')
    .update({ image_suggestions: candidates as unknown as Json })
    .eq('id', postId)
    .eq('tenant_id', tenantId)

  if (updateError) throw new Error(`Failed to store image candidates: ${updateError.message}`)

  console.log(`[clem/images] Stored ${candidates.length} image candidates for post ${postId}`)
}
