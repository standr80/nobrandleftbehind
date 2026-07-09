import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkspace, resolveMutationWorkspace } from '@/lib/workspace/active'

interface Params {
  params: Promise<{ id: string }>
}

// GET — the questions assigned to this topic, in order.
export async function GET(_request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const workspace = await getActiveWorkspace(userId)
  if (!workspace) return NextResponse.json({ error: 'No workspace found' }, { status: 404 })

  const db = createAdminClient()
  const { data: topic } = await db
    .from('faq_topics')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', workspace.tenantId)
    .maybeSingle()
  if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 })

  const { data: links } = await db
    .from('faq_topic_questions')
    .select('question_id, position')
    .eq('topic_id', id)
  const posById = new Map<string, number>(
    ((links ?? []) as { question_id: string; position: number | null }[]).map(
      (l) => [l.question_id, l.position ?? 0] as [string, number],
    ),
  )
  const qids = [...posById.keys()]
  if (!qids.length) return NextResponse.json({ questions: [] })

  const { data: qs } = await db
    .from('faq_questions')
    .select('id, question, answer, source, status')
    .in('id', qids)
  const ordered = ((qs ?? []) as { id: string }[])
    .slice()
    .sort((a, b) => (posById.get(a.id) ?? 0) - (posById.get(b.id) ?? 0))
  return NextResponse.json({ questions: ordered })
}

// POST — assign questions to the topic. Body: { tenantId, questionIds: string[] }.
export async function POST(request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const workspace = await resolveMutationWorkspace(userId, body.tenantId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const db = createAdminClient()
  const { data: topic } = await db
    .from('faq_topics')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', workspace.tenantId)
    .maybeSingle()
  if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 })

  const questionIds: string[] = Array.isArray(body.questionIds)
    ? body.questionIds.filter((q: unknown) => typeof q === 'string')
    : []
  if (!questionIds.length) return NextResponse.json({ error: 'No questions to assign' }, { status: 400 })

  const { data: existing } = await db
    .from('faq_topic_questions')
    .select('position')
    .eq('topic_id', id)
  let pos = ((existing ?? []) as { position: number | null }[]).reduce(
    (m, r) => Math.max(m, r.position ?? 0),
    0,
  )
  const rows = questionIds.map((question_id) => ({ topic_id: id, question_id, position: ++pos }))

  // Ignore already-assigned (composite PK) rather than error.
  const { error } = await db
    .from('faq_topic_questions')
    .upsert(rows, { onConflict: 'topic_id,question_id', ignoreDuplicates: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — unassign a question from the topic. Body: { tenantId, questionId }.
export async function DELETE(request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const workspace = await resolveMutationWorkspace(userId, body.tenantId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const db = createAdminClient()
  const { data: topic } = await db
    .from('faq_topics')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', workspace.tenantId)
    .maybeSingle()
  if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 })

  const questionId = String(body.questionId ?? '')
  if (!questionId) return NextResponse.json({ error: 'questionId required' }, { status: 400 })

  const { error } = await db
    .from('faq_topic_questions')
    .delete()
    .eq('topic_id', id)
    .eq('question_id', questionId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
