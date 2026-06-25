import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveMutationWorkspace } from '@/lib/workspace/active'

// POST — pull Scout PAA/gap opportunities into the FAQ question bank.
// Dedupes against existing questions (case-insensitive). Returns inserted count.
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tenantId } = await request.json().catch(() => ({}))
  const workspace = await resolveMutationWorkspace(userId, tenantId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const db = createAdminClient()

  const [{ data: opps }, { data: existing }] = await Promise.all([
    db
      .from('scout_keyword_opportunities')
      .select('keyword')
      .eq('tenant_id', workspace.tenantId)
      .in('opportunity_type', ['paa', 'gap'])
      .limit(200),
    db.from('faq_questions').select('question').eq('tenant_id', workspace.tenantId),
  ])

  const have = new Set((existing ?? []).map((r) => (r.question ?? '').trim().toLowerCase()))
  const seen = new Set<string>()
  const toInsert = (opps ?? [])
    .map((o) => (o.keyword ?? '').trim())
    .filter((q) => {
      const k = q.toLowerCase()
      if (q.length <= 3 || have.has(k) || seen.has(k)) return false
      seen.add(k)
      return true
    })

  if (!toInsert.length) return NextResponse.json({ ok: true, imported: 0 })

  const { data, error } = await db
    .from('faq_questions')
    .insert(
      toInsert.map((question) => ({
        tenant_id: workspace.tenantId,
        question,
        source: 'scout_paa',
        status: 'open',
      })),
    )
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, imported: data?.length ?? 0 })
}
