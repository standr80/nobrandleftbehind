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
  const seedKeywords: string[] = extractSeedKeywords(tenant.brand_voice, tenant.target_audience)

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
    } catch (err) {
      console.error(`[Scout] Pipeline 3 failed for tenant ${tenantId}:`, err)
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

function extractSeedKeywords(brandVoice: string | null, targetAudience: string | null): string[] {
  const combined = [brandVoice ?? '', targetAudience ?? ''].join(' ')
  // Extract significant words (3+ chars, not stop words)
  const stopWords = new Set([
    'and', 'the', 'for', 'with', 'our', 'your', 'that', 'this', 'from', 'are',
    'has', 'have', 'will', 'can', 'who', 'what', 'when', 'where', 'how', 'why',
  ])
  return combined
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w))
    .slice(0, 20)
}
