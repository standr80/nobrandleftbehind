import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GitHub App webhook — listens for pull_request events.
 *
 * When a PR that was opened by NBLB is merged, this handler:
 *  1. Verifies the X-Hub-Signature-256 header (GITHUB_WEBHOOK_SECRET env var)
 *  2. Matches the PR number to a blog_posts row via git_pr_number
 *  3. Sets status='published', published_at, git_merge_sha
 *
 * Set the webhook URL in your GitHub App settings to:
 *   https://<your-domain>/api/webhooks/github
 *
 * Required env var: GITHUB_WEBHOOK_SECRET
 */

async function verifySignature(request: Request, rawBody: string): Promise<boolean> {
  const secret = process.env.GITHUB_WEBHOOK_SECRET
  if (!secret) {
    // If no secret is configured, skip verification (dev only)
    console.warn('[webhook/github] GITHUB_WEBHOOK_SECRET not set — skipping signature check')
    return true
  }

  const signature = request.headers.get('x-hub-signature-256')
  if (!signature) return false

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody))
  const expected = 'sha256=' + Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  // Constant-time comparison
  if (signature.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < signature.length; i++) {
    diff |= signature.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0
}

export async function POST(request: Request) {
  const rawBody = await request.text()

  // ── 1. Verify signature ─────────────────────────────────────────────────────
  const valid = await verifySignature(request, rawBody)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // ── 2. Only handle merged PRs ───────────────────────────────────────────────
  if (payload.action !== 'closed') {
    return NextResponse.json({ ok: true, skipped: 'not a closed event' })
  }

  const pr = payload.pull_request as Record<string, unknown> | undefined
  if (!pr?.merged) {
    return NextResponse.json({ ok: true, skipped: 'PR closed but not merged' })
  }

  const prNumber = pr.number as number
  const mergeCommitSha = pr.merge_commit_sha as string | null
  const repoFullName = (
    (payload.repository as Record<string, unknown>)?.full_name as string | undefined
  )

  if (!prNumber || !repoFullName) {
    return NextResponse.json({ error: 'Missing pr.number or repository.full_name' }, { status: 400 })
  }

  // ── 3. Find the matching blog post ──────────────────────────────────────────
  const db = createAdminClient()

  // Match by pr number + repo (via tenant git_repo)
  const { data: posts } = await db
    .from('blog_posts')
    .select('id, tenant_id, title, status')
    .eq('git_pr_number', prNumber)
    .in('status', ['pr_open', 'scheduled', 'approved'])

  if (!posts?.length) {
    // Not one of our PRs — ignore silently
    return NextResponse.json({ ok: true, skipped: 'no matching blog post' })
  }

  // Filter by tenant's git_repo matching the webhook's repo
  const { data: tenants } = await db
    .from('tenants')
    .select('id, git_repo')
    .in('id', posts.map((p) => p.tenant_id))

  const matchingTenantIds = new Set(
    (tenants ?? [])
      .filter((t) => t.git_repo === repoFullName)
      .map((t) => t.id)
  )

  const post = posts.find((p) => matchingTenantIds.has(p.tenant_id))

  if (!post) {
    return NextResponse.json({ ok: true, skipped: 'no post matched repo' })
  }

  // ── 4. Mark as published ────────────────────────────────────────────────────
  const now = new Date().toISOString()

  await db
    .from('blog_posts')
    .update({
      status: 'published',
      published_at: now,
      git_merge_sha: mergeCommitSha ?? null,
      updated_at: now,
    })
    .eq('id', post.id)

  await db.from('publish_log').insert({
    tenant_id: post.tenant_id,
    post_id: post.id,
    action: 'github_pr_merged',
    success: true,
    response_data: {
      pr_number: prNumber,
      merge_commit_sha: mergeCommitSha,
      repo: repoFullName,
    },
    attempted_at: now,
  })

  console.log(`[webhook/github] Post ${post.id} ("${post.title}") marked published via PR #${prNumber}`)

  return NextResponse.json({ ok: true, postId: post.id })
}
