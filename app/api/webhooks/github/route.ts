import { NextResponse } from 'next/server'

// Sprint 4 — listens for PR merge events from GitHub App webhook
// Verifies the signature, updates git_merge_sha, sets status to 'published'
export async function POST(request: Request) {
  const payload = await request.json()

  if (payload.action !== 'closed' || !payload.pull_request?.merged) {
    return NextResponse.json({ ok: true })
  }

  // TODO Sprint 4: verify X-Hub-Signature-256, match PR number to blog_posts, update record
  return NextResponse.json({ ok: true, message: 'Not yet implemented — Sprint 4' })
}
