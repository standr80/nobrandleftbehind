import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateNextSlot } from '@/lib/clem/schedule'
import { runPublish } from '@/lib/clem/publish'

interface Params {
  params: Promise<{ postId: string }>
}

type Action = 'submit_review' | 'approve' | 'request_changes' | 'reject' | 'publish_now' | 'unpublish'

export async function POST(request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { postId } = await params
  const { action, reviewerNotes, scheduledFor, autoSchedule, heroImageUrl, heroImageCredit, heroImageAlt } =
    await request.json() as {
      action: Action
      reviewerNotes?: string
      scheduledFor?: string
      autoSchedule?: boolean
      heroImageUrl?: string
      heroImageCredit?: string
      heroImageAlt?: string
    }

  const db = createAdminClient()

  const { data: post } = await db
    .from('blog_posts')
    .select('tenant_id, title, status')
    .eq('id', postId)
    .single()

  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  const { data: member } = await db
    .from('tenant_members')
    .select('id, email, name')
    .eq('tenant_id', post.tenant_id)
    .eq('clerk_user_id', userId)
    .maybeSingle()

  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const now = new Date().toISOString()

  switch (action) {
    case 'submit_review': {
      await db
        .from('blog_posts')
        .update({ status: 'in_review', submitted_for_review_at: now })
        .eq('id', postId)

      // Send email notification if Resend is configured
      if (process.env.RESEND_API_KEY && member.email) {
        try {
          const { sendDraftReadyEmail } = await import('@/lib/email/send')
          const { data: tenant } = await db
            .from('tenants')
            .select('name')
            .eq('id', post.tenant_id)
            .single()
          await sendDraftReadyEmail({
            to: member.email,
            postTitle: post.title,
            postId,
            tenantName: tenant?.name ?? 'your site',
          })
        } catch (e) {
          console.error('[email] Failed to send review notification:', e)
        }
      }
      break
    }

    case 'approve': {
      let finalScheduledFor: string | null = null

      if (autoSchedule) {
        const slot = await calculateNextSlot(post.tenant_id)
        finalScheduledFor = slot.toISOString()
      } else if (scheduledFor) {
        finalScheduledFor = new Date(scheduledFor).toISOString()
      }

      await db
        .from('blog_posts')
        .update({
          status: finalScheduledFor ? 'scheduled' : 'approved',
          approved_at: now,
          approved_by: member.id,
          reviewer_notes: reviewerNotes ?? null,
          scheduled_for: finalScheduledFor,
          auto_scheduled: autoSchedule ?? false,
          ...(heroImageUrl ? { hero_image_url: heroImageUrl } : {}),
          ...(heroImageCredit ? { hero_image_credit: heroImageCredit } : {}),
          ...(heroImageAlt ? { hero_image_alt: heroImageAlt } : {}),
        })
        .eq('id', postId)
      break
    }

    case 'request_changes': {
      await db
        .from('blog_posts')
        .update({ status: 'draft', reviewer_notes: reviewerNotes ?? null })
        .eq('id', postId)
      break
    }

    case 'reject': {
      await db
        .from('blog_posts')
        .update({ status: 'rejected', reviewer_notes: reviewerNotes ?? null })
        .eq('id', postId)
      break
    }

    case 'publish_now': {
      // For git-based tenants, open a GitHub PR instead of direct publish.
      // The post will move to 'pr_open'; it becomes 'published' when the PR merges.
      const { data: tenant } = await db
        .from('tenants')
        .select('cms_type')
        .eq('id', post.tenant_id)
        .single()

      if (tenant?.cms_type === 'git') {
        // First stamp approval so the post is in a valid state
        await db
          .from('blog_posts')
          .update({
            approved_at: now,
            approved_by: member.id,
            reviewer_notes: reviewerNotes ?? null,
          })
          .eq('id', postId)

        await runPublish(post.tenant_id, postId)
      } else {
        await db
          .from('blog_posts')
          .update({
            status: 'published',
            published_at: now,
            approved_at: now,
            approved_by: member.id,
            reviewer_notes: reviewerNotes ?? null,
          })
          .eq('id', postId)
      }
      break
    }

    case 'unpublish': {
      await db
        .from('blog_posts')
        .update({
          status: 'draft',
          published_at: null,
          scheduled_for: null,
        })
        .eq('id', postId)
      break
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
