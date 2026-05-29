import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkspace } from '@/lib/workspace/active'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getActiveWorkspace(userId)
  if (!workspace) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

  const { keyword, position, search_volume } = await request.json()

  let title: string
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 80,
      messages: [{
        role: 'user',
        content: `Generate a single compelling blog post title for "${workspace.tenant.name}" targeting this keyword: "${keyword}". Rules: Title only, no quotes, no explanation, 6-12 words, SEO-friendly.`,
      }],
    })
    title = (msg.content[0] as { type: 'text'; text: string }).text.trim()
  } catch {
    title = keyword
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('suggestions')
    .insert({
      tenant_id: workspace.tenantId,
      proposed_title: title,
      rationale: `Currently ranking position ${position ?? 'unknown'} for "${keyword}"${search_volume ? ` (${search_volume.toLocaleString()}/mo search volume)` : ''} — a dedicated post could push this into the top 3.`,
      target_keywords: [keyword],
      source: 'scout',
      source_type: 'rank_opportunity',
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}
