/**
 * Scout → Clem Handoff
 *
 * Converts Scout findings (keyword gaps, PAA questions, competitor content gaps,
 * seasonal windows, rising trends) into suggestions in Clem's queue.
 *
 * Claude generates a post title from each keyword so Clem has a concrete
 * article to draft rather than a raw keyword.
 */

import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import type { CompetitorResult } from './pipelines/competitors'
import type { SearchOpportunityResult, OpportunityItem } from './pipelines/search-opportunity'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface HandoffResult {
  suggestionsCreated: number
  opportunitiesUpdated: number
}

// ─── Generate a post title from a keyword ────────────────────────────────────

async function generateTitle(
  keyword: string,
  context: string,
  tenantName: string,
): Promise<string> {
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 80,
    messages: [
      {
        role: 'user',
        content: `Generate a single compelling blog post title for "${tenantName}" based on this keyword/question: "${keyword}"
Context: ${context}
Rules: Title only, no quotes, no explanation, 6-12 words, SEO-friendly, specific.`,
      },
    ],
  })
  return (msg.content[0] as { type: 'text'; text: string }).text.trim()
}

// ─── Main handoff function ────────────────────────────────────────────────────

export async function pushToClem(
  tenantId: string,
  tenantName: string,
  competitorResults: CompetitorResult[],
  searchResults: SearchOpportunityResult,
  maxSuggestions = 10,
): Promise<HandoffResult> {
  const db = createAdminClient()

  // Collect items to hand off — prioritised order
  const candidates: OpportunityItem[] = []

  // 1. Competitor keyword gaps (most actionable)
  for (const comp of competitorResults) {
    for (const gap of comp.keywordGaps.slice(0, 3)) {
      candidates.push({
        keyword: gap.keyword,
        searchVolume: gap.search_volume,
        keywordDifficulty: gap.keyword_difficulty,
        opportunityType: 'gap',
        competitorRankingUrl: gap.competitor_url,
        rationale: `Competitor at ${gap.competitor_url ?? comp.competitorUrl} ranks for "${gap.keyword}" (vol: ${gap.search_volume ?? 'unknown'}) — you have no content for this.`,
      })
    }
    // 2. New blog posts from competitors = content gap signal
    for (const post of comp.newBlogPosts.slice(0, 2)) {
      candidates.push({
        keyword: post.title,
        searchVolume: null,
        keywordDifficulty: null,
        opportunityType: 'gap',
        competitorRankingUrl: post.url,
        rationale: `Competitor at ${comp.competitorUrl} just published: "${post.title}". Consider covering this topic first.`,
      })
    }
  }

  // 3. Seasonal windows (time-sensitive — high priority)
  candidates.push(...searchResults.seasonalWindows)
  // 4. Rising trends
  candidates.push(...searchResults.risingTrends)
  // 5. Featured snippets
  candidates.push(...searchResults.featuredSnippetTargets)
  // 6. PAA questions
  candidates.push(...searchResults.paaQuestions.slice(0, 5))

  // Deduplicate and cap
  const seen = new Set<string>()
  const deduped = candidates.filter((c) => {
    const key = c.keyword.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const toProcess = deduped.slice(0, maxSuggestions)
  if (!toProcess.length) return { suggestionsCreated: 0, opportunitiesUpdated: 0 }

  let suggestionsCreated = 0
  let opportunitiesUpdated = 0

  for (const item of toProcess) {
    try {
      const title = await generateTitle(item.keyword, item.rationale, tenantName)

      const { data: suggestion, error } = await db
        .from('suggestions')
        .insert({
          tenant_id: tenantId,
          proposed_title: title,
          rationale: item.rationale,
          target_keywords: [item.keyword],
          source: 'scout',
          source_type: item.opportunityType,
          status: 'pending',
        })
        .select('id')
        .single()

      if (error) {
        console.error('[Scout] Failed to insert suggestion:', error)
        continue
      }

      suggestionsCreated++

      // Link back to keyword opportunity record
      const { error: updateError } = await db
        .from('scout_keyword_opportunities')
        .update({
          status: 'sent_to_clem',
          clem_suggestion_id: suggestion.id,
        })
        .eq('tenant_id', tenantId)
        .eq('keyword', item.keyword)
        .eq('status', 'pending')

      if (!updateError) opportunitiesUpdated++
    } catch (err) {
      console.error(`[Scout] Handoff error for "${item.keyword}":`, err)
    }
  }

  return { suggestionsCreated, opportunitiesUpdated }
}
