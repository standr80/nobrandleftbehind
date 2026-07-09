import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkspace, resolveMutationWorkspace } from '@/lib/workspace/active'

const TOPIC_COLUMNS = 'id, name, status, generated_post_id, created_at'

// GET — list FAQ topics for the active workspace, with question counts.
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getActiveWorkspace(userId)
  if (!workspace) return NextResponse.json({ error: 'No workspace found' }, { status: 404 })

  const db = createAdminClient()
  const { data: topics, error } = await db
    .from('faq_topics')
    .select(TOPIC_COLUMNS)
    .eq('tenant_id', workspace.tenantId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids = (topics ?? []).map((t) => t.id)
  const counts: Record<string, number> = {}
  if (ids.length) {
    const { data: links } = await db
      .from('faq_topic_questions')
      .select('topic_id')
      .in('topic_id', ids)
    for (const l of links ?? []) counts[l.topic_id] = (counts[l.topic_id] ?? 0) + 1
  }

  return NextResponse.json({
    topics: (topics ?? []).map((t) => ({ ...t, questionCount: counts[t.id] ?? 0 })),
  })
}

// POST — create a topic. Body: { tenantId, name }.
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const workspace = await resolveMutationWorkspace(userId, body.tenantId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const name = String(body.name ?? '').trim()
  if (!name) return NextResponse.json({ error: 'A topic name is required' }, { status: 400 })

  const db = createAdminClient()
  const { data, error } = await db
    .from('faq_topics')
    .insert({ tenant_id: workspace.tenantId, name, status: 'draft' })
    .select(TOPIC_COLUMNS)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, topic: { ...data, questionCount: 0 } })
}
