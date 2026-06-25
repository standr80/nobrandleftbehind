import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveMutationWorkspace } from '@/lib/workspace/active'


export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { keyword, position, search_volume, position_change, tenantId } = await request.json()
  const workspace = await resolveMutationWorkspace(userId, tenantId)
  if (!workspace) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

  const isDeclining = typeof position_change === 'number' && position_change < 0
  const volumeStr = search_volume ? ` (${search_volume.toLocaleString()}/mo search volume)` : ''

  const db = createAdminClient()
  const { data: tenantRow } = await db.from('tenants').select('name').eq('id', workspace.tenantId).maybeSingle()
  const tenantName = tenantRow?.name ?? 'the business'

  // Avoid creating duplicate briefs for the same keyword — and skip the Claude
  // call entirely if one already exists in the queue.
  const { data: existing } = await db
    .from('suggestions')
    .select('id, proposed_title')
    .eq('tenant_id', workspace.tenantId)
    .eq('source', 'scout')
    .eq('source_type', 'rank_opportunity')
    .eq('status', 'pending')
    .contains('target_keywords', [keyword])
    .limit(1)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ id: existing.id, title: existing.proposed_title, alreadyExists: true })
  }

  const titleIntent = isDeclining
    ? `The site is losing ground for this keyword and needs a strong, refreshed post to defend and recover the ranking.`
    : `The site ranks near the top for this keyword and a dedicated post could push it into the top 3.`

  let title: string
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 80,
      messages: [{
        role: 'user',
        content: `Generate a single compelling blog post title for "${tenantName}" targeting this keyword: "${keyword}". Context: ${titleIntent} Rules: Title only, no quotes, no explanation, 6-12 words, SEO-friendly.`,
      }],
    })
    title = (msg.content[0] as { type: 'text'; text: string }).text.trim()
  } catch {
    title = keyword
  }

  const rationale = isDeclining
    ? `Slipped ${Math.abs(position_change)} place${Math.abs(position_change) !== 1 ? 's' : ''} to position ${position ?? 'unknown'} for "${keyword}"${volumeStr} — a refreshed, dedicated post could recover and defend this ranking.`
    : `Currently ranking position ${position ?? 'unknown'} for "${keyword}"${volumeStr} — a dedicated post could push this into the top 3.`

  const { data, error } = await db
    .from('suggestions')
    .insert({
      tenant_id: workspace.tenantId,
      proposed_title: title,
      rationale,
      target_keywords: [keyword],
      source: 'scout',
      source_type: 'rank_opportunity',
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id, title, alreadyExists: false })
}
