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
import { pushToClem } from './clem-handoff'
import { generateAndDeliverBriefing } from './briefing'

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
  }

  // Pipeline 2 — Competitor intelligence
  if (competitorUrls.length) {
    try {
      competitorResults = await runCompetitorPipeline(tenantId, tenant.domain, competitorUrls)
    } catch (err) {
      console.error(`[Scout] Pipeline 2 failed for tenant ${tenantId}:`, err)
    }
  }

  // Pipeline 3 — Search opportunity (requires DataForSEO)
  if (process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD) {
    try {
      searchResults = await runSearchOpportunityPipeline(tenantId, tenant.domain, seedKeywords)
      // Post a one-time diagnostic watch alert showing what Pipeline 3 found
      // (auto-actioned so it doesn't clutter the dashboard after the first run)
      await db.from('scout_alerts').insert({
        tenant_id: tenantId,
        alert_type: 'pipeline3_diagnostic',
        severity: 'watch',
        title: `Pipeline 3 complete — ${searchResults.totalAdded} opportunities found`,
        detail: [
          `Seed keywords used: ${seedKeywords.slice(0, 5).join(', ')}${seedKeywords.length > 5 ? ` (+${seedKeywords.length - 5} more)` : ''}`,
          `Featured snippets: ${searchResults.featuredSnippetTargets.length}`,
          `PAA questions: ${searchResults.paaQuestions.length}`,
          `Seasonal windows: ${searchResults.seasonalWindows.length}`,
          `Rising trends: ${searchResults.risingTrends.length}`,
          `Total added to opportunities: ${searchResults.totalAdded}`,
        ].join(' · '),
        actioned: searchResults.totalAdded > 0, // auto-action if successful
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

  // Clem handoff
  let handoffResult = { suggestionsCreated: 0, opportunitiesUpdated: 0 }
  try {
    handoffResult = await pushToClem(tenantId, tenant.name, competitorResults, searchResults)
  } catch (err) {
    console.error(`[Scout] Clem handoff failed for tenant ${tenantId}:`, err)
  }

  // Generate and deliver briefing
  try {
    const briefingId = await generateAndDeliverBriefing(
      tenantId,
      tenant.name,
      competitorResults,
      searchResults,
      handoffResult,
    )
    return { tenantId, briefingId }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { tenantId, briefingId: null, error: `Briefing generation failed: ${message}` }
  }
}

/**
 * Run Scout for ALL tenants with Scout enabled.
 * Used by the weekly cron job.
 */
export async function runScoutForAllTenants(): Promise<ScoutRunResult[]> {
  const db = createAdminClient()

  const { data: configs, error } = await db
    .from('scout_config')
    .select('tenant_id')
    .eq('enabled', true)

  if (error || !configs?.length) return []

  const results: ScoutRunResult[] = []
  for (const config of configs) {
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
    model: 'claude-sonnet-4-20250514',
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
