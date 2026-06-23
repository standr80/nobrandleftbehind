/**
 * Scout Briefing — Claude synthesis and email delivery
 *
 * Takes results from Pipelines 2 & 3, calls Claude to synthesise into
 * the structured RAG-coded weekly briefing, saves to scout_briefings,
 * and sends via Resend.
 */

import { Resend } from 'resend'
import { anthropic } from '@/lib/anthropic'
import { createAdminClient } from '@/lib/supabase/admin'
import type { CompetitorResult } from './pipelines/competitors'
import type { SearchOpportunityResult } from './pipelines/search-opportunity'
import type { HandoffResult } from './clem-handoff'
import type { RankSnapshotSummary } from './pipelines/own-site'

const resend = new Resend(process.env.RESEND_API_KEY)

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BriefingSection {
  severity: 'urgent' | 'watch' | 'win'
  title: string
  detail: string
  action?: string
}

export interface BriefingJson {
  tenantName: string
  weekStarting: string
  generatedAt: string
  urgent: BriefingSection[]
  watch: BriefingSection[]
  wins: BriefingSection[]
  clemQueueSummary: string[]
  numbers: {
    competitorsMonitored: number
    newCompetitorPages: number
    pricingChanges: number
    keywordOpportunities: number
    suggestionsAddedToClem: number
  }
}

// ─── Claude synthesis ─────────────────────────────────────────────────────────

async function synthesiseBriefing(
  tenantName: string,
  weekStarting: string,
  competitorResults: CompetitorResult[],
  searchResults: SearchOpportunityResult,
  handoffResult: HandoffResult,
  rankSummary: RankSnapshotSummary | null,
): Promise<BriefingJson> {
  const prompt = {
    tenantName,
    rankingMovements: rankSummary
      ? {
          keywordsTracked: rankSummary.tracked,
          improved: rankSummary.improved,
          declined: rankSummary.declined,
          enteredTop10: rankSummary.enteredTop10,
          droppedFromTop10: rankSummary.droppedFromTop10,
          biggestMover: rankSummary.biggestMover,
        }
      : null,
    competitorChanges: competitorResults.map((c) => ({
      url: c.competitorUrl,
      changed: c.changed,
      newPagesCount: c.newPages.length,
      removedPagesCount: c.removedPages.length,
      newBlogPosts: c.newBlogPosts,
      pricingChanged: c.pricingChanged,
      pricingChangeSummary: c.pricingChangeSummary,
      keywordGapsCount: c.keywordGaps.length,
      highAuthBacklinksCount: c.newHighAuthBacklinks.length,
      newHighAuthBacklinks: c.newHighAuthBacklinks.slice(0, 3),
      error: c.error,
    })),
    searchOpportunities: {
      featuredSnippetTargets: searchResults.featuredSnippetTargets.slice(0, 5),
      paaQuestions: searchResults.paaQuestions.slice(0, 5),
      seasonalWindows: searchResults.seasonalWindows,
      risingTrends: searchResults.risingTrends.slice(0, 5),
    },
    clemSuggestionsAdded: handoffResult.suggestionsCreated,
  }

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system: `You are Scout, a market intelligence agent for ${tenantName}.
Synthesise the provided data into a structured weekly briefing.
Be direct and specific. Use plain English. No jargon.
Every item must have a clear implication or recommended action.
Categorise every item as:
- urgent: needs action this week (pricing changes, major competitor moves, seasonal deadlines, keywords dropped from top 10)
- watch: monitor, no action needed yet (competitor new content, rising trends, backlinks, keywords that improved or entered top 10)
- win: positive signals (opportunities identified, actions taken, keyword improvements)

Return ONLY valid JSON matching this structure exactly:
{
  "urgent": [{"title": "...", "detail": "...", "action": "..."}],
  "watch": [{"title": "...", "detail": "...", "action": "..."}],
  "wins": [{"title": "...", "detail": "..."}],
  "clemQueueSummary": ["Post title added — reason", ...]
}`,
    messages: [
      {
        role: 'user',
        content: JSON.stringify(prompt),
      },
    ],
  })

  let parsed: { urgent: Omit<BriefingSection, 'severity'>[]; watch: Omit<BriefingSection, 'severity'>[]; wins: Omit<BriefingSection, 'severity'>[]; clemQueueSummary: string[] }
  try {
    const text = (msg.content[0] as { type: 'text'; text: string }).text
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    parsed = JSON.parse(jsonMatch?.[0] ?? text)
  } catch {
    parsed = { urgent: [], watch: [], wins: [], clemQueueSummary: [] }
  }

  const totalNewPages = competitorResults.reduce((s, c) => s + c.newPages.length, 0)
  const pricingChanges = competitorResults.filter((c) => c.pricingChanged).length

  return {
    tenantName,
    weekStarting,
    generatedAt: new Date().toISOString(),
    urgent: parsed.urgent.map((i) => ({ ...i, severity: 'urgent' as const })),
    watch: parsed.watch.map((i) => ({ ...i, severity: 'watch' as const })),
    wins: parsed.wins.map((i) => ({ ...i, severity: 'win' as const })),
    clemQueueSummary: parsed.clemQueueSummary ?? [],
    numbers: {
      competitorsMonitored: competitorResults.filter((c) => !c.error).length,
      newCompetitorPages: totalNewPages,
      pricingChanges,
      keywordOpportunities: searchResults.totalAdded,
      suggestionsAddedToClem: handoffResult.suggestionsCreated,
    },
  }
}

// ─── HTML render ──────────────────────────────────────────────────────────────

function renderBriefingHtml(briefing: BriefingJson, dashboardUrl: string): string {
  const severityBadge = (s: BriefingSection['severity']) => {
    if (s === 'urgent') return '<span style="color:#dc2626;font-weight:700">🔴 URGENT</span>'
    if (s === 'watch') return '<span style="color:#d97706;font-weight:700">🟡 WATCH</span>'
    return '<span style="color:#16a34a;font-weight:700">🟢 WIN</span>'
  }

  const renderSection = (items: BriefingSection[]) =>
    items
      .map(
        (item) => `
    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:12px">
      <div style="margin-bottom:6px">${severityBadge(item.severity)} &nbsp; <strong>${item.title}</strong></div>
      <div style="color:#374151;font-size:14px;margin-bottom:${item.action ? '8px' : '0'}">${item.detail}</div>
      ${item.action ? `<div style="color:#6b7280;font-size:13px;font-style:italic">→ ${item.action}</div>` : ''}
    </div>`,
      )
      .join('')

  const all = [...briefing.urgent, ...briefing.watch, ...briefing.wins]

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Scout Weekly Briefing — ${briefing.tenantName}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:680px;margin:0 auto;padding:24px;color:#111827">
  <div style="border-bottom:3px solid #4f46e5;padding-bottom:16px;margin-bottom:24px">
    <h1 style="font-size:22px;margin:0 0 4px">Scout Weekly Briefing</h1>
    <div style="color:#6b7280;font-size:14px">${briefing.tenantName} &nbsp;·&nbsp; Week of ${briefing.weekStarting} &nbsp;·&nbsp; Generated ${new Date(briefing.generatedAt).toLocaleString()}</div>
  </div>

  <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:24px;text-align:center">
    ${[
      ['Competitors monitored', briefing.numbers.competitorsMonitored],
      ['New competitor pages', briefing.numbers.newCompetitorPages],
      ['Pricing changes', briefing.numbers.pricingChanges],
      ['Keyword opportunities', briefing.numbers.keywordOpportunities],
      ['Added to Clem', briefing.numbers.suggestionsAddedToClem],
    ]
      .map(
        ([label, val]) =>
          `<div style="background:#f9fafb;border-radius:8px;padding:12px"><div style="font-size:22px;font-weight:700;color:#4f46e5">${val}</div><div style="font-size:11px;color:#6b7280;margin-top:4px">${label}</div></div>`,
      )
      .join('')}
  </div>

  ${
    briefing.urgent.length
      ? `<h2 style="font-size:16px;margin:0 0 12px;color:#dc2626">🔴 URGENT — ${briefing.urgent.length} item${briefing.urgent.length !== 1 ? 's' : ''}</h2>${renderSection(briefing.urgent)}`
      : ''
  }

  ${
    briefing.watch.length
      ? `<h2 style="font-size:16px;margin:24px 0 12px;color:#d97706">🟡 WATCH — ${briefing.watch.length} item${briefing.watch.length !== 1 ? 's' : ''}</h2>${renderSection(briefing.watch)}`
      : ''
  }

  ${
    briefing.wins.length
      ? `<h2 style="font-size:16px;margin:24px 0 12px;color:#16a34a">🟢 WINS — ${briefing.wins.length} item${briefing.wins.length !== 1 ? 's' : ''}</h2>${renderSection(briefing.wins)}`
      : ''
  }

  ${
    briefing.clemQueueSummary.length
      ? `<h2 style="font-size:16px;margin:24px 0 12px;color:#4f46e5">📝 ADDED TO CLEM'S QUEUE — ${briefing.clemQueueSummary.length} item${briefing.clemQueueSummary.length !== 1 ? 's' : ''}</h2>
      <ul style="margin:0;padding-left:20px">${briefing.clemQueueSummary.map((s) => `<li style="margin-bottom:6px;font-size:14px;color:#374151">${s}</li>`).join('')}</ul>`
      : ''
  }

  ${!all.length ? '<p style="color:#6b7280">No significant changes detected this week.</p>' : ''}

  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center">
    <a href="${dashboardUrl}" style="background:#4f46e5;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500">View full briefing in dashboard →</a>
  </div>
</body>
</html>`
}

// ─── Save and send ────────────────────────────────────────────────────────────

export async function saveBriefing(
  tenantId: string,
  briefing: BriefingJson,
  dashboardUrl: string,
): Promise<string> {
  const db = createAdminClient()
  const html = renderBriefingHtml(briefing, dashboardUrl)

  const { data, error } = await db
    .from('scout_briefings')
    .insert({
      tenant_id: tenantId,
      week_starting: briefing.weekStarting,
      status: 'ready',
      briefing_html: html,
      briefing_json: briefing as unknown as import('@/lib/supabase/types').Json,
      urgent_count: briefing.urgent.length,
      watch_count: briefing.watch.length,
      wins_count: briefing.wins.length,
      clem_suggestions_added: briefing.numbers.suggestionsAddedToClem,
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to save briefing: ${error.message}`)
  return data.id
}

export async function sendBriefingEmail(
  briefingId: string,
  tenantId: string,
  briefing: BriefingJson,
  dashboardUrl: string,
): Promise<void> {
  const db = createAdminClient()

  // Get all admin emails for this tenant
  const { data: admins } = await db
    .from('tenant_members')
    .select('email, name')
    .eq('tenant_id', tenantId)
    .eq('role', 'admin')

  const recipients = (admins ?? []).filter((a): a is { email: string; name: string | null } => !!a.email)
  if (!recipients.length) return

  const html = renderBriefingHtml(briefing, dashboardUrl)

  for (const recipient of recipients) {
    await resend.emails.send({
      from: 'Scout <scout@nobrandleftbehind.com>',
      to: recipient.email,
      subject: `Scout Weekly Briefing — ${briefing.tenantName} — ${briefing.weekStarting}`,
      html,
    })
  }

  await db
    .from('scout_briefings')
    .update({ status: 'delivered', email_sent_at: new Date().toISOString() })
    .eq('id', briefingId)
}

// ─── Orchestrate full briefing generation ─────────────────────────────────────

export async function generateAndDeliverBriefing(
  tenantId: string,
  tenantName: string,
  competitorResults: CompetitorResult[],
  searchResults: SearchOpportunityResult,
  handoffResult: HandoffResult,
  rankSummary?: RankSnapshotSummary | null,
): Promise<string> {
  const weekStarting = new Date().toISOString().slice(0, 10)
  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://nobrandleftbehind.com'}/dashboard/scout`

  const briefing = await synthesiseBriefing(
    tenantName,
    weekStarting,
    competitorResults,
    searchResults,
    handoffResult,
    rankSummary ?? null,
  )

  const briefingId = await saveBriefing(tenantId, briefing, dashboardUrl)

  // Send email — if it fails, the briefing is still saved in the dashboard
  try {
    await sendBriefingEmail(briefingId, tenantId, briefing, `${dashboardUrl}/briefings/${briefingId}`)
  } catch (err) {
    console.error('[Scout] Failed to send briefing email:', err)
  }

  return briefingId
}
