import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkspace, resolveMutationWorkspace } from '@/lib/workspace/active'

const QUESTION_COLUMNS = 'id, question, answer, source, topic, status, used_in_post_id, created_at'

// GET — list FAQ questions for the active workspace.
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getActiveWorkspace(userId)
  if (!workspace) return NextResponse.json({ error: 'No workspace found' }, { status: 404 })

  const db = createAdminClient()
  const { data, error } = await db
    .from('faq_questions')
    .select(QUESTION_COLUMNS)
    .eq('tenant_id', workspace.tenantId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ questions: data ?? [] })
}

// POST — add one or more manual questions. Body: { question } or { questions: string[] }.
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const workspace = await resolveMutationWorkspace(userId, body.tenantId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const topic = body.topic ? String(body.topic).trim() : null
  const topicId = body.topicId ? String(body.topicId) : null

  // Two shapes: plain strings, or {question, answer} pairs (manual Q&A / import).
  type Incoming = { question: string; answer?: string | null }
  let incoming: Incoming[]
  if (Array.isArray(body.pairs)) {
    incoming = (body.pairs as { question?: unknown; answer?: unknown }[])
      .map((p) => ({ question: String(p.question ?? '').trim(), answer: p.answer ? String(p.answer).trim() : null }))
  } else {
    const raw: unknown[] = Array.isArray(body.questions) ? body.questions : [body.question]
    const answer = body.answer ? String(body.answer).trim() : null
    incoming = raw.map((q) => ({ question: String(q ?? '').trim(), answer }))
  }
  incoming = incoming.filter((p) => p.question.length > 3)
  if (!incoming.length) return NextResponse.json({ error: 'No valid questions provided' }, { status: 400 })

  const db = createAdminClient()
  const { data, error } = await db
    .from('faq_questions')
    .insert(
      incoming.map((p) => ({
        tenant_id: workspace.tenantId,
        question: p.question,
        answer: p.answer,
        topic,
        source: 'manual',
        status: 'open',
      })),
    )
    .select(QUESTION_COLUMNS)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Optionally assign the new questions straight to a topic.
  if (topicId && data?.length) {
    const { data: existing } = await db
      .from('faq_topic_questions')
      .select('position')
      .eq('topic_id', topicId)
    let pos = ((existing ?? []) as { position: number | null }[]).reduce(
      (m, r) => Math.max(m, r.position ?? 0),
      0,
    )
    await db.from('faq_topic_questions').insert(
      (data as { id: string }[]).map((r) => ({ topic_id: topicId, question_id: r.id, position: ++pos })),
    )
  }

  return NextResponse.json({ ok: true, questions: data ?? [] })
}
