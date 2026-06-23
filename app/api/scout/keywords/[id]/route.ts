/**
 * PATCH /api/scout/keywords/[id]
 * Update a keyword opportunity status.
 *
 * status=dismissed  → marks the opportunity dismissed, no further action.
 * status=sent_to_clem → generates a Clem suggestion (Claude title) and
 *                        inserts it into the suggestions table, then links back.
 */

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkspace } from '@/lib/workspace/active'

interface Props {
  params: Promise<{ id: string }>
}


export async function PATCH(request: Request, { params }: Props) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getActiveWorkspace(userId)
  if (!workspace) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

  const body = await request.json()
  const { status } = body as { status?: string }
  if (!status || !['dismissed', 'sent_to_clem'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const db = createAdminClient()

  // Fetch the opportunity so we can act on its data
  const { data: opp, error: fetchError } = await db
    .from('scout_keyword_opportunities')
    .select('id, keyword, opportunity_type, status, clem_suggestion_id')
    .eq('id', id)
    .eq('tenant_id', workspace.tenantId)
    .single()

  if (fetchError || !opp) {
    return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
  }

  // Allow dismissing from either pending or sent_to_clem
  // (approving/adding to Clem is only valid from pending)
  if (status === 'sent_to_clem' && opp.status !== 'pending') {
    return NextResponse.json({ error: 'Can only add to Clem from pending status' }, { status: 409 })
  }
  if (opp.status === 'dismissed') {
    return NextResponse.json({ error: 'Already dismissed' }, { status: 409 })
  }

  // ── Dismiss: just update the status ──────────────────────────────────────────
  if (status === 'dismissed') {
    const { data, error } = await db
      .from('scout_keyword_opportunities')
      .update({ status: 'dismissed' })
      .eq('id', id)
      .eq('tenant_id', workspace.tenantId)
      .select('id, status')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // ── Approve: generate a Clem suggestion via Claude ───────────────────────────
  let title: string
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 80,
      messages: [
        {
          role: 'user',
          content: `Generate a single compelling blog post title for "${workspace.tenant.name}" based on this keyword/question: "${opp.keyword}"
Rules: Title only, no quotes, no explanation, 6-12 words, SEO-friendly, specific.`,
        },
      ],
    })
    title = (msg.content[0] as { type: 'text'; text: string }).text.trim()
  } catch {
    title = opp.keyword
  }

  const { data: suggestion, error: suggError } = await db
    .from('suggestions')
    .insert({
      tenant_id: workspace.tenantId,
      proposed_title: title,
      rationale: `Scout keyword opportunity: "${opp.keyword}"`,
      target_keywords: [opp.keyword],
      source: 'scout',
      source_type: opp.opportunity_type,
      status: 'pending',
    })
    .select('id')
    .single()

  if (suggError || !suggestion) {
    return NextResponse.json({ error: 'Failed to create Clem suggestion' }, { status: 500 })
  }

  // Link opportunity back to the new suggestion
  const { data, error } = await db
    .from('scout_keyword_opportunities')
    .update({ status: 'sent_to_clem', clem_suggestion_id: suggestion.id })
    .eq('id', id)
    .eq('tenant_id', workspace.tenantId)
    .select('id, status, clem_suggestion_id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
