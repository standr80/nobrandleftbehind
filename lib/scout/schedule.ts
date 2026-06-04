/**
 * Scout run orchestration — called by /api/scout/weekly and /api/scout/run
 *
 * Runs all pipelines for a single tenant, then synthesises the briefing.
 * Designed to be fault-tolerant: if a pipeline fails, log the error and
 * continue with remaining pipelines. A partial briefing is better than none.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { runCompetitorPipeline } from './pipelines/competitors'
import { runSearchOpportunityPipeline } from './pipelines/search-opportunity'
import { generateAndDeliverBriefing } from './briefing'
import { captureRankSnapshot, type RankSnapshotSummary } from './pipelines/own-site'

export interface ScoutRunResult {
  tenantId: string
  briefingId: string | null
  error?: string
}

export async function runScoutForTenant(tenantId: string): Promise<ScoutRunResult> {
  const db = createAdminClient()

  // Load tenant + scout config
  const [tenantRes, configRes] = await Promise.all([
    db.from('tenants').select('name, domain, brand_voice, target_audience, reference_urls').eq('id', tenantId).single(),
    db.from('scout_config').select('*').eq('tenant_id', tenantId).maybeSingle(),
  ])

  if (tenantRes.error || !tenantRes.data) {
    return { tenantId, briefingId: null, error: `Tenant not found: ${tenantRes.error?.message}` }
  }

  const tenant = tenantRes.data
  const config = configRes.data

  // Auto-create scout_config if it doesn't exist yet
  if (!config) {
    await db.from('scout_config').insert({ tenant_id: tenantId })
  }

  // Merge Clem's reference_urls with Scout-specific competitor_urls, deduplicating.
  // reference_urls is the primary source (set in Clem Settings); competitor_urls are Scout additions.
  const competitorUrls: string[] = [
    ...(tenant.reference_urls ?? []),
    ...(config?.competitor_urls ?? []),
  ].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 5)
  const seedKeywords: string[] = await extractSeedKeywords(
    tenant.brand_voice,
    tenant.target_audience,
    tenant.domain,
    competitorUrls,
  )

  let competitorResults: Awaited<ReturnType<typeof runCompetitorPipeline>> = []
  let searchResults: Awaited<ReturnType<typeof runSearchOpportunityPipeline>> = {
    keywordGaps: [],
    featuredSnippetTargets: [],
    paaQuestions: [],
    seasonalWindows: [],
    risingTrends: [],
    totalAdded: 0,
    stepErrors: [],
    rawPAACount: 0,
    aiOverviewCount: 0,
    expandedKeywordCount: 0,
  }

  // Per-feature toggles (default on when config/column is absent)
  const trackCompetitors = config?.track_competitors ?? true
  const trackKeywords = config?.track_keywords ?? true
  const trackRankings = config?.track_rankings ?? true
  const rankAlertThreshold = config?.rank_alert_threshold ?? 5
  // Primary search location for keyword & competitor research (default UK)
  const locationCode = config?.location_code ?? 2826
  // Rank tracking can span multiple markets — always include the primary.
  const rankLocationCodes = Array.from(
    new Set<number>([locationCode, ...((config?.rank_location_codes as number[] | null) ?? [2826])]),
  )
  const rankDevices = (config?.rank_devices as string[] | null) ?? ['desktop']

  // Pipeline 2 — Competitor intelligence
  if (trackCompetitors && competitorUrls.length) {
    try {
      competitorResults = await runCompetitorPipeline(tenantId, tenant.domain, competitorUrls, locationCode)
    } catch (err) {
      console.error(`[Scout] Pipeline 2 failed for tenant ${tenantId}:`, err)
    }
  }

  // Pipeline 3 — Search opportunity (requires DataForSEO)
  if (trackKeywords && process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD) {
    try {
      searchResults = await runSearchOpportunityPipeline(tenantId, tenant.domain, seedKeywords, locationCode)
      // Post a one-time diagnostic watch alert showing what Pipeline 3 found
      // (auto-actioned so it doesn't clutter the dashboard after the first run)
      const diagnosticParts = [
        `Seed keywords used: ${seedKeywords.slice(0, 5).join(', ')}${seedKeywords.length > 5 ? ` (+${seedKeywords.length - 5} more)` : ''}`,
        `Expanded keywords: ${searchResults.expandedKeywordCount}`,
        `Featured snippets: ${searchResults.featuredSnippetTargets.length}`,
        `PAA questions: ${searchResults.paaQuestions.length} (${searchResults.rawPAACount} raw from API)`,
        `AI Overview keywords: ${searchResults.aiOverviewCount ?? 0}`,
        `Seasonal windows: ${searchResults.seasonalWindows.length}`,
        `Rising trends: ${searchResults.risingTrends.length}`,
        `Total added to opportunities: ${searchResults.totalAdded}`,
      ]
      if (searchResults.stepErrors.length) {
        diagnosticParts.push(`Step errors: ${searchResults.stepErrors.join(' | ')}`)
      }
      await db.from('scout_alerts').insert({
        tenant_id: tenantId,
        alert_type: 'pipeline3_diagnostic',
        severity: searchResults.stepErrors.length > 0 ? 'urgent' : 'watch',
        title: `Pipeline 3 complete — ${searchResults.totalAdded} opportunities found${searchResults.stepErrors.length ? ` (${searchResults.stepErrors.length} errors)` : ''}`,
        detail: diagnosticParts.join(' · '),
        actioned: searchResults.totalAdded > 0 && searchResults.stepErrors.length === 0,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[Scout] Pipeline 3 failed for tenant ${tenantId}:`, message)
      // Surface the error as a watch alert so it's visible in the dashboard
      try {
        await db.from('scout_alerts').insert({
          tenant_id: tenantId,
          alert_type: 'pipeline_error',
          severity: 'watch',
          title: 'Keyword opportunity pipeline failed',
          detail: message,
        })
      } catch { /* ignore secondary error */ }
    }
  } else {
    console.warn(`[Scout] Pipeline 3 skipped — DATAFORSEO_LOGIN/PASSWORD not set for tenant ${tenantId}`)
    // Surface as a watch alert on first run so admin knows why opportunities are empty
    const { data: existingAlert } = await db
      .from('scout_alerts')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('alert_type', 'dataforseo_not_configured')
      .limit(1)
      .maybeSingle()
    if (!existingAlert) {
      await db.from('scout_alerts').insert({
        tenant_id: tenantId,
        alert_type: 'dataforseo_not_configured',
        severity: 'watch',
        title: 'DataForSEO not configured',
        detail: 'Keyword opportunities, SERP gap analysis, PAA mining, and trend detection require DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD environment variables. Add them in Vercel settings to enable Pipeline 3.',
      })
    }
  }

  // Rank snapshot
  let rankSummary: RankSnapshotSummary | null = null
  if (trackRankings && process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD) {
    try {
      rankSummary = await captureRankSnapshot(tenantId, tenant.domain, rankAlertThreshold, rankLocationCodes, rankDevices)
    } catch (err) {
      console.error(`[Scout] Rank snapshot failed for tenant ${tenantId}:`, err)
    }
  }

  // Opportunities are left in 'pending' state for the user to review
  // on the Keywords page. They are sent to Clem only when manually approved.
  const handoffResult = { suggestionsCreated: 0, opportunitiesUpdated: 0 }

  // Generate and deliver briefing
  try {
    const briefingId = await generateAndDeliverBriefing(
      tenantId,
      tenant.name,
      competitorResults,
      searchResults,
      handoffResult,
      rankSummary,
    )
    return { tenantId, briefingId }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { tenantId, briefingId: null, error: `Briefing generation failed: ${message}` }
  }
}

/**
 * Run Scout for all tenants that have opted in to the automatic weekly run.
 * Used by the weekly cron job.
 *
 * Cost controls:
 * - Emergency kill-switch: set SCOUT_AUTO_RUN_DISABLED=true to halt all
 *   automatic runs immediately (manual /api/scout/run is unaffected).
 * - Opt-in: only tenants with scout_config.auto_run_enabled = true are run.
 * - Hard cap: at most SCOUT_MAX_TENANTS_PER_RUN tenants per invocation
 *   (default 50) so a runaway can't bill unbounded.
 */
export async function runScoutForAllTenants(): Promise<ScoutRunResult[]> {
  if (process.env.SCOUT_AUTO_RUN_DISABLED === 'true') {
    console.warn('[Scout] Automatic run skipped — SCOUT_AUTO_RUN_DISABLED is set')
    return []
  }

  const db = createAdminClient()

  const { data: configs, error } = await db
    .from('scout_config')
    .select('tenant_id')
    .eq('enabled', true)
    .eq('auto_run_enabled', true)

  if (error || !configs?.length) return []

  const cap = Number(process.env.SCOUT_MAX_TENANTS_PER_RUN) || 50
  const toRun = configs.slice(0, cap)
  if (configs.length > toRun.length) {
    console.warn(
      `[Scout] ${configs.length} tenants opted in but capped at ${cap} this run (SCOUT_MAX_TENANTS_PER_RUN)`,
    )
  }

  const results: ScoutRunResult[] = []
  for (const config of toRun) {
    const result = await runScoutForTenant(config.tenant_id)
    results.push(result)
  }
  return results
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Use Claude to generate proper search-intent keyword phrases from the
 * tenant's brand context. N-gram extraction produces meaningless phrases
 * like "based speak" — Claude produces real keywords like "custom print uk".
 */
async function extractSeedKeywords(
  brandVoice: string | null,
  targetAudience: string | null,
  domain: string,
  competitorUrls: string[],
): Promise<string[]> {
  // Competitor domain names as context clues
  const competitorDomains = competitorUrls.map((url) => {
    try {
      const hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname
      return hostname.replace(/^www\./, '').split('.')[0]
    } catch { return '' }
  }).filter(Boolean)

  if (!brandVoice && !targetAudience && !competitorDomains.length) {
    return []
  }

  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `Generate 15 real search-engine keyword phrases for a business with this profile:
Domain: ${domain}
Brand voice: ${brandVoice ?? 'not set'}
Target audience: ${targetAudience ?? 'not set'}
Competitor domains: ${competitorDomains.join(', ') || 'none'}

Rules:
- Return ONLY the keywords, one per line, nothing else
- Each keyword must be 2-4 words that real customers would type into Google
- Focus on products/services, not brand descriptions
- Include location-relevant terms if the business is local
- Example good output: "custom business card printing", "cheap banner printing uk"
- Do NOT include brand names or competitor names`,
    }],
  })

  const text = (msg.content[0] as { type: 'text'; text: string }).text
  return text
    .split('\n')
    .map((l) => l.replace(/^[-•*\d.)\s]+/, '').trim().toLowerCase())
    .filter((l) => l.length > 3 && l.includes(' '))
    .slice(0, 15)
}
