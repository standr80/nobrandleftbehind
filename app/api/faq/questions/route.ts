import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkspace, resolveMutationWorkspace } from '@/lib/workspace/active'

const QUESTION_COLUMNS = 'id, question, source, topic, status, used_in_post_id, created_at'

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

  const raw: unknown[] = Array.isArray(body.questions) ? body.questions : [body.question]
  const topic = body.topic ? String(body.topic).trim() : null

  const questions = Array.from(
    new Set(
      raw
        .map((q) => String(q ?? '').trim())
        .filter((q) => q.length > 3),
    ),
  )
  if (!questions.length) return NextResponse.json({ error: 'No valid questions provided' }, { status: 400 })

  const db = createAdminClient()
  const { data, error } = await db
    .from('faq_questions')
    .insert(
      questions.map((question) => ({
        tenant_id: workspace.tenantId,
        question,
        topic,
        source: 'manual',
        status: 'open',
      })),
    )
    .select(QUESTION_COLUMNS)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, questions: data ?? [] })
}
