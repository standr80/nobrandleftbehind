import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'hero-images'

interface Params {
  params: Promise<{ postId: string }>
}

export async function POST(request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { postId } = await params
  const db = createAdminClient()

  // Verify user belongs to this post's tenant
  const { data: post } = await db
    .from('blog_posts')
    .select('tenant_id')
    .eq('id', postId)
    .single()

  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  const { data: member } = await db
    .from('tenant_members')
    .select('id')
    .eq('tenant_id', post.tenant_id)
    .eq('clerk_user_id', userId)
    .maybeSingle()

  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Parse the uploaded file
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Only JPEG, PNG, WebP and GIF are supported' }, { status: 400 })
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File must be under 10 MB' }, { status: 400 })
  }

  // Ensure bucket exists (creates it if missing, no-op if already there)
  await db.storage.createBucket(BUCKET, { public: true }).catch(() => {})

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${post.tenant_id}/${postId}-${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: urlData } = db.storage.from(BUCKET).getPublicUrl(path)

  return NextResponse.json({ ok: true, url: urlData.publicUrl })
}
