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

type ParsedSections = {
  urgent: Omit<BriefingSection, 'severity'>[]
  watch: Omit<BriefingSection, 'severity'>[]
  wins: Omit<BriefingSection, 'severity'>[]
  clemQueueSummary: string[]
}

/**
 * Deterministic briefing built straight from the pipeline data, used when the
 * Claude synthesis call is unavailable (e.g. a sustained 529 "overloaded" from
 * the Anthropic API). Less polished than the AI version, but it means a Scout
 * run still completes and surfaces its key signals instead of failing outright.
 */
function buildFallbackSections(
  competitorResults: CompetitorResult[],
  searchResults: SearchOpportunityResult,
  rankSummary: RankSnapshotSummary | null,
): ParsedSections {
  const urgent: Omit<BriefingSection, 'severity'>[] = []
  const watch: Omit<BriefingSection, 'severity'>[] = []
  const wins: Omit<BriefingSection, 'severity'>[] = []

  // Urgent — competitor pricing changes
  for (const c of competitorResults) {
    if (c.pricingChanged) {
      urgent.push({
        title: `Pricing change detected: ${c.competitorUrl}`,
        detail: c.pricingChangeSummary ?? 'This competitor changed its pricing page.',
        action: 'Review their new pricing and check yours stays competitive.',
      })
    }
  }
  // Urgent — seasonal deadlines
  for (const s of searchResults.seasonalWindows) {
    urgent.push({
      title: `Seasonal opportunity: ${s.keyword}`,
      detail: s.weeksUntilPeak != null ? `Peaks in roughly ${s.weeksUntilPeak} week(s).` : 'Approaching its seasonal peak.',
      action: 'Publish content now to rank before the peak.',
    })
  }
  // Urgent — rankings lost
  if (rankSummary && rankSummary.droppedFromTop10 > 0) {
    urgent.push({
      title: `${rankSummary.droppedFromTop10} keyword(s) dropped out of the top 10`,
      detail: 'One or more tracked keywords fell out of the top 10 this period.',
      action: 'Review the affected pages and refresh the content.',
    })
  }

  // Watch — competitor activity
  for (const c of competitorResults) {
    const bits: string[] = []
    if (c.newPages.length) bits.push(`${c.newPages.length} new page(s)`)
    if (c.newBlogPosts.length) bits.push(`${c.newBlogPosts.length} new blog post(s)`)
    if (c.newHighAuthBacklinks.length) bits.push(`${c.newHighAuthBacklinks.length} new high-authority backlink(s)`)
    if (bits.length) {
      watch.push({
        title: `Competitor activity: ${c.competitorUrl}`,
        detail: `${bits.join(', ')}.`,
        action: 'Review what they published and consider matching it.',
      })
    }
  }
  // Watch — rising trends
  if (searchResults.risingTrends.length) {
    watch.push({
      title: `${searchResults.risingTrends.length} rising trend(s) detected`,
      detail: `${searchResults.risingTrends.slice(0, 5).map((t) => t.keyword).join(', ')}.`,
      action: 'Consider content targeting these emerging searches.',
    })
  }

  // Wins — opportunities found
  if (searchResults.totalAdded > 0) {
    wins.push({
      title: `${searchResults.totalAdded} keyword opportunit${searchResults.totalAdded === 1 ? 'y' : 'ies'} identified`,
      detail: 'New opportunities were added to your Keywords page for review.',
    })
  }
  // Wins — ranking gains
  if (rankSummary && (rankSummary.improved > 0 || rankSummary.enteredTop10 > 0)) {
    const parts: string[] = []
    if (rankSummary.improved > 0) parts.push(`${rankSummary.improved} keyword(s) improved`)
    if (rankSummary.enteredTop10 > 0) parts.push(`${rankSummary.enteredTop10} entered the top 10`)
    wins.push({ title: 'Ranking improvements', detail: `${parts.join(', ')}.` })
  }

  return { urgent, watch, wins, clemQueueSummary: [] }
}

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

  let parsed: ParsedSections
  try {
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

    const text = (msg.content[0] as { type: 'text'; text: string }).text
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    parsed = JSON.parse(jsonMatch?.[0] ?? text)
  } catch (err) {
    // Claude unavailable (e.g. 529 overload) or returned unparseable output —
    // fall back to a deterministic briefing so the run still completes.
    console.error('[Scout] Briefing synthesis unavailable — using deterministic fallback:', err instanceof Error ? err.message : err)
    parsed = buildFallbackSections(competitorResults, searchResults, rankSummary)
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
