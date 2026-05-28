/**
 * Scout Pipeline 3 — Search Opportunity
 *
 * 1. Keyword gap: what does the search landscape have that client has no content for?
 * 2. Featured snippet opportunities: near-ranking queries (pos 4-20) with a snippet available
 * 3. People Also Ask mining: unanswered PAA questions from top client queries
 * 4. Seasonal trend advance warnings: peaks arriving in 6-10 weeks
 * 5. Rising trend detection: volume growing > 20% month-on-month
 *
 * All results are persisted to scout_keyword_opportunities.
 * Actionable items are returned for clem-handoff.ts to push to the suggestions table.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import {
  getDomainRankings,
  getPeopleAlsoAskWithAIOverview,
  getSerpFeatures,
  getKeywordTrends,
  getKeywordSuggestions,
  type DfsTrendItem,
} from '@/lib/integrations/dataforseo/client'

export interface SearchOpportunityResult {
  keywordGaps: OpportunityItem[]
  featuredSnippetTargets: OpportunityItem[]
  paaQuestions: OpportunityItem[]
  seasonalWindows: OpportunityItem[]
  risingTrends: OpportunityItem[]
  totalAdded: number
  stepErrors: string[]
  rawPAACount: number
  aiOverviewCount: number
  expandedKeywordCount: number
}

export interface OpportunityItem {
  keyword: string
  searchVolume: number | null
  keywordDifficulty: number | null
  opportunityType: 'gap' | 'featured_snippet' | 'paa' | 'seasonal' | 'rising_trend'
  competitorRankingUrl?: string | null
  seasonalPeakMonth?: number | null
  weeksUntilPeak?: number | null
  rationale: string
  hasAiOverview?: boolean
  aiOverviewSnippet?: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function weeksUntilMonth(targetMonth: number): number {
  const now = new Date()
  const currentMonth = now.getMonth() + 1 // 1-12
  let monthsAway = targetMonth - currentMonth
  if (monthsAway <= 0) monthsAway += 12
  return Math.round(monthsAway * 4.33)
}

function findPeakMonth(monthly: { year: number; month: number; search_volume: number }[]): number | null {
  if (!monthly.length) return null
  let maxVol = 0
  let peakMonth = 1
  for (const pt of monthly) {
    if (pt.search_volume > maxVol) {
      maxVol = pt.search_volume
      peakMonth = pt.month
    }
  }
  return peakMonth
}

function hasSeasonalPattern(item: DfsTrendItem): boolean {
  const monthly = item.monthly_searches
  if (monthly.length < 6) return false
  const max = Math.max(...monthly.map((p) => p.search_volume))
  const min = Math.min(...monthly.map((p) => p.search_volume))
  return max > 0 && min / max < 0.5 // peak is at least 2x the trough
}

// ─── Main pipeline function ───────────────────────────────────────────────────

export async function runSearchOpportunityPipeline(
  tenantId: string,
  clientDomain: string,
  seedKeywords: string[],
): Promise<SearchOpportunityResult> {
  const db = createAdminClient()

  const opportunityItems: OpportunityItem[] = []
  const errors: string[] = []

  // ── 3.1 DataForSEO domain rankings to understand where client currently ranks ──
  let clientRankingKeywords: string[] = []
  try {
    const rankings = await getDomainRankings(clientDomain, 2826, 100)
    clientRankingKeywords = rankings
      .map((r) => r.keyword)
      .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
  } catch (err) {
    errors.push(`getDomainRankings: ${err instanceof Error ? err.message : String(err)}`)
  }

  // ── 3.2 Featured snippet opportunities (near-ranking queries pos 4-20) ──
  const featuredSnippetTargets: OpportunityItem[] = []
  if (clientRankingKeywords.length) {
    try {
      // Use keywords where client ranks 4-20 (near-ranking)
      const nearRankingKeywords = clientRankingKeywords.slice(0, 30)
      const serpFeatures = await getSerpFeatures(nearRankingKeywords, clientDomain)
      for (const item of serpFeatures) {
        if (
          item.has_featured_snippet &&
          item.client_position !== null &&
          item.client_position >= 4 &&
          item.client_position <= 20
        ) {
          const opp: OpportunityItem = {
            keyword: item.keyword,
            searchVolume: item.search_volume,
            keywordDifficulty: null,
            opportunityType: 'featured_snippet',
            rationale: `You rank #${item.client_position} for "${item.keyword}" but don't hold the featured snippet. Structured content (list, table, or definition) could win it.`,
          }
          featuredSnippetTargets.push(opp)
          opportunityItems.push(opp)
        }
      }
    } catch (err) {
      errors.push(`getSerpFeatures: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ── 3.2b Expand seed keywords via DataForSEO keyword suggestions ──
  let expandedKeywords: string[] = seedKeywords
  let expandedKeywordCount = 0
  try {
    const suggestions = await getKeywordSuggestions(seedKeywords.slice(0, 15))
    expandedKeywordCount = suggestions.length
    const suggestedKws = suggestions.map((s) => s.keyword)
    // Merge: original seeds + expanded, deduped
    const merged = Array.from(new Set([...seedKeywords, ...suggestedKws]))
    expandedKeywords = merged.slice(0, 200)
    console.log(`[Scout] Expanded ${seedKeywords.length} seed keywords to ${expandedKeywords.length} via DataForSEO suggestions`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('402') || msg.includes('40200') || msg.includes('Payment Required')) {
      console.warn('[Scout] Keyword expansion skipped — DataForSEO account balance low:', msg)
    } else {
      console.error('[Scout] Keyword expansion failed, using original seeds:', err)
    }
    expandedKeywords = seedKeywords
  }

  // ── 3.3 PAA mining ──
  const paaQuestions: OpportunityItem[] = []
  let rawPAACount = 0
  const topQueryKeywords = [...expandedKeywords.slice(0, 30), ...clientRankingKeywords.slice(0, 10)]
  const aiOverviewByKeyword: Record<string, { hasAiOverview: boolean; aiOverviewSnippet: string | null }> = {}
  if (topQueryKeywords.length) {
    try {
      // Check cache first — don't re-fetch PAA within 14 days
      const { data: cachedEntries } = await db
        .from('scout_paa_cache')
        .select('seed_keyword, questions')
        .eq('tenant_id', tenantId)
        .in('seed_keyword', topQueryKeywords.slice(0, 10))
        .gt('expires_at', new Date().toISOString())

      const cachedKeywords = new Set((cachedEntries ?? []).map((c) => c.seed_keyword))
      const uncachedKeywords = topQueryKeywords.slice(0, 10).filter((k) => !cachedKeywords.has(k))

      let freshPAAResults: Record<string, { question: string; serp_position?: number }[]> = {}
      if (uncachedKeywords.length) {
        const freshSerpData = await getPeopleAlsoAskWithAIOverview(uncachedKeywords)
        rawPAACount = Object.values(freshSerpData).reduce((s, d) => s + d.paaQuestions.length, 0)
        // Reshape to match existing freshPAAResults usage
        freshPAAResults = Object.fromEntries(
          Object.entries(freshSerpData).map(([kw, d]) => [kw, d.paaQuestions])
        )
        // Capture AI overview flags per keyword
        for (const [kw, d] of Object.entries(freshSerpData)) {
          aiOverviewByKeyword[kw] = { hasAiOverview: d.hasAiOverview, aiOverviewSnippet: d.aiOverviewSnippet }
        }

        // Cache fresh results
        const cacheInserts = Object.entries(freshPAAResults).map(([keyword, questions]) => ({
          tenant_id: tenantId,
          seed_keyword: keyword,
          questions: questions as unknown as import('@/lib/supabase/types').Json,
          fetched_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        }))
        if (cacheInserts.length) {
          await db.from('scout_paa_cache').upsert(cacheInserts, {
            onConflict: 'tenant_id,seed_keyword',
          })
        }
      }

      // Merge cached + fresh
      const allPAA: Record<string, string[]> = {}
      for (const cached of cachedEntries ?? []) {
        const qs = cached.questions as unknown as { question: string }[]
        allPAA[cached.seed_keyword] = qs.map((q) => q.question)
      }
      for (const [kw, qs] of Object.entries(freshPAAResults)) {
        allPAA[kw] = qs.map((q) => q.question)
      }

      // Identify unanswered questions (client has no content for them)
      // Simple heuristic: question keyword not in clientRankingKeywords
      const clientKeywordSet = new Set(clientRankingKeywords.map((k) => k.toLowerCase()))
      for (const [seedKw, questions] of Object.entries(allPAA)) {
        const aiInfo = aiOverviewByKeyword[seedKw]
        for (const question of questions) {
          const words = question.toLowerCase().split(/\s+/)
          const isAnswered = words.some((w) => clientKeywordSet.has(w))
          if (!isAnswered) {
            const aiNote = aiInfo?.hasAiOverview
              ? '. NOTE FOR CLEM: Google shows an AI Overview for this keyword. Write this post in structured Q&A format with a clear direct answer in the opening paragraph. Aim to be the source Google\'s AI Overview cites.'
              : ''
            const opp: OpportunityItem = {
              keyword: question,
              searchVolume: null,
              keywordDifficulty: null,
              opportunityType: 'paa',
              rationale: `People searching for "${seedKw}" also ask: "${question}". You don't currently cover this.${aiNote}`,
              hasAiOverview: aiInfo?.hasAiOverview ?? false,
              aiOverviewSnippet: aiInfo?.aiOverviewSnippet ?? null,
            }
            paaQuestions.push(opp)
            opportunityItems.push(opp)
            if (paaQuestions.length >= 10) break
          }
        }
        if (paaQuestions.length >= 10) break
      }
    } catch (err) {
      errors.push(`getPeopleAlsoAsk: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ── 3.4 Seasonal trends + 3.5 Rising trends ──
  const seasonalWindows: OpportunityItem[] = []
  const risingTrends: OpportunityItem[] = []
  const trendKeywords = [...expandedKeywords, ...clientRankingKeywords.slice(0, 20)]
    .filter((k) => typeof k === 'string' && k.trim().length > 0)
    .slice(0, 30)

  if (trendKeywords.length) {
    try {
      const trends = await getKeywordTrends(trendKeywords)

      for (const trend of trends) {
        // Seasonal: clear seasonal pattern with peak 6-10 weeks away
        if (hasSeasonalPattern(trend)) {
          const peakMonth = findPeakMonth(trend.monthly_searches)
          if (peakMonth !== null) {
            const weeks = weeksUntilMonth(peakMonth)
            if (weeks >= 6 && weeks <= 10) {
              const opp: OpportunityItem = {
                keyword: trend.keyword,
                searchVolume: trend.search_volume,
                keywordDifficulty: null,
                opportunityType: 'seasonal',
                seasonalPeakMonth: peakMonth,
                weeksUntilPeak: weeks,
                rationale: `"${trend.keyword}" peaks in month ${peakMonth} — ${weeks} weeks away. Publish now to allow indexing time.`,
              }
              seasonalWindows.push(opp)
              opportunityItems.push(opp)
            }
          }
        }

        // Rising: volume growing > 20% month-on-month
        if (trend.growth_pct !== null && trend.growth_pct > 10) {
          const opp: OpportunityItem = {
            keyword: trend.keyword,
            searchVolume: trend.search_volume,
            keywordDifficulty: null,
            opportunityType: 'rising_trend',
            rationale: `"${trend.keyword}" is rising ${trend.growth_pct}% month-on-month. Early content could capture this trend before competitors.`,
          }
          risingTrends.push(opp)
          opportunityItems.push(opp)
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // 402 / 40200 = DataForSEO billing issue — log but don't surface as a
      // pipeline error in the UI since it's an account state, not a bug.
      if (msg.includes('402') || msg.includes('40200') || msg.includes('Payment Required')) {
        console.warn('[Scout] Keyword trends skipped — DataForSEO account balance low:', msg)
      } else {
        errors.push(`getKeywordTrends: ${msg}`)
      }
    }
  }

  if (errors.length) {
    console.error('[Scout] Search opportunity pipeline errors:', errors)
  }

  // Persist all opportunities to scout_keyword_opportunities

  let totalAdded = 0
  if (opportunityItems.length) {
    const inserts = opportunityItems.map((item) => ({
      tenant_id: tenantId,
      keyword: item.keyword,
      search_volume: item.searchVolume,
      keyword_difficulty: item.keywordDifficulty,
      opportunity_type: item.opportunityType,
      competitor_ranking_url: item.competitorRankingUrl ?? null,
      seasonal_peak_month: item.seasonalPeakMonth ?? null,
      weeks_until_peak: item.weeksUntilPeak ?? null,
      status: 'pending' as const,
      has_ai_overview: item.hasAiOverview ?? false,
      ai_overview_snippet: item.aiOverviewSnippet ?? null,
    }))
    const { error } = await db.from('scout_keyword_opportunities').insert(inserts)
    if (!error) totalAdded = inserts.length
    else console.error('[Scout] Failed to insert keyword opportunities:', error)
  }

  return {
    keywordGaps: [],
    featuredSnippetTargets,
    paaQuestions,
    seasonalWindows,
    risingTrends,
    totalAdded,
    stepErrors: errors,
    rawPAACount,
    aiOverviewCount: opportunityItems.filter((i) => i.hasAiOverview).length,
    expandedKeywordCount,
  }
}

