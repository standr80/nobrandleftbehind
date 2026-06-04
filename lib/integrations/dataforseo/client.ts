/**
 * DataForSEO API wrapper — server-side only.
 * Credentials are never exposed to the browser.
 *
 * Docs: https://docs.dataforseo.com/v3/
 */

const BASE_URL = 'https://api.dataforseo.com/v3'

function getAuthHeader(): string {
  const login = process.env.DATAFORSEO_LOGIN
  const password = process.env.DATAFORSEO_PASSWORD
  if (!login || !password) {
    throw new Error('DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD env vars are required')
  }
  return 'Basic ' + Buffer.from(`${login}:${password}`).toString('base64')
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`DataForSEO ${path} HTTP ${res.status}: ${text}`)
  }
  const json = (await res.json()) as {
    status_code?: number
    status_message?: string
    tasks?: Array<{ status_code?: number; status_message?: string }>
  }
  // DataForSEO wraps API errors in status_code inside the JSON body
  // rather than using HTTP error codes. 20000 = success, 4xxxx = error.
  if (json.status_code && json.status_code !== 20000) {
    throw new Error(
      `DataForSEO ${path} API error ${json.status_code}: ${json.status_message ?? 'unknown error'}`,
    )
  }
  // Also check first task status code
  const firstTask = json.tasks?.[0]
  if (firstTask?.status_code && firstTask.status_code !== 20000) {
    throw new Error(
      `DataForSEO ${path} task error ${firstTask.status_code}: ${firstTask.status_message ?? 'unknown error'}`,
    )
  }
  return json as unknown as T
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DfsKeywordItem {
  keyword: string
  search_volume: number | null
  keyword_difficulty: number | null
  competition: number | null
  cpc: number | null
}

export interface DfsDomainRankingItem {
  keyword: string
  ranked_serp_element?: {
    serp_item?: {
      rank_absolute?: number
      url?: string
    }
  }
  search_volume: number | null
  keyword_difficulty: number | null
}

export interface DfsPAAItem {
  question: string
  serp_position?: number
}

export interface DfsSeasonalPoint {
  year: number
  month: number
  search_volume: number
}

// ─── Domain Rankings (where does this domain rank?) ───────────────────────────

export async function getDomainRankings(
  domain: string,
  locationCode = 2826, // UK
  limit = 100,
): Promise<DfsDomainRankingItem[]> {
  type Resp = { tasks?: Array<{ result?: Array<{ items?: DfsDomainRankingItem[] }> }> }
  const data = await post<Resp>('/dataforseo_labs/google/ranked_keywords/live', [
    {
      target: domain,
      location_code: locationCode,
      limit,
      filters: [['ranked_serp_element.serp_item.rank_absolute', '<=', 20]],
    },
  ])
  return data?.tasks?.[0]?.result?.[0]?.items ?? []
}

// ─── Keyword Gap (competitor has, client doesn't) ─────────────────────────────

export interface DfsGapItem {
  keyword: string
  search_volume: number | null
  keyword_difficulty: number | null
  competitor_position: number | null
  competitor_url: string | null
}

export async function getKeywordGap(
  clientDomain: string,
  competitorDomains: string[],
  locationCode = 2826,
  limit = 50,
): Promise<DfsGapItem[]> {
  if (!competitorDomains.length) return []

  type Resp = {
    tasks?: Array<{
      result?: Array<{
        items?: Array<{
          keyword_data?: { keyword: string; search_volume?: number; keyword_difficulty?: number }
          ranked_serp_elements?: Array<{
            domain: string
            rank_absolute?: number
            url?: string
          }>
        }>
      }>
    }>
  }

  const data = await post<Resp>('/dataforseo_labs/google/domain_intersection/live', [
    {
      targets: competitorDomains.reduce(
        (acc, d) => ({ ...acc, [d]: {} }),
        {} as Record<string, object>,
      ),
      exclude_targets: [clientDomain],
      location_code: locationCode,
      filters: [
        ['keyword_data.search_volume', '>', 50],
        'and',
        ['keyword_data.keyword_difficulty', '<', 70],
      ],
      order_by: ['keyword_data.search_volume,desc'],
      limit,
    },
  ])

  const items = data?.tasks?.[0]?.result?.[0]?.items ?? []
  return items.map((item) => {
    const compEl = item.ranked_serp_elements?.find((el) =>
      competitorDomains.some((d) => el.domain?.includes(d)),
    )
    return {
      keyword: item.keyword_data?.keyword ?? '',
      search_volume: item.keyword_data?.search_volume ?? null,
      keyword_difficulty: item.keyword_data?.keyword_difficulty ?? null,
      competitor_position: compEl?.rank_absolute ?? null,
      competitor_url: compEl?.url ?? null,
    }
  })
}

// ─── PAA (People Also Ask) ────────────────────────────────────────────────────

export async function getPeopleAlsoAsk(
  keywords: string[],
  locationCode = 2826,
): Promise<Record<string, DfsPAAItem[]>> {
  if (!keywords.length) return {}

  type Resp = {
    tasks?: Array<{
      result?: Array<{
        keyword: string
        items?: Array<{
          type: string
          items?: Array<{ title?: string; featured_title?: string }>
        }>
      }>
    }>
  }

  // /live endpoints only accept ONE task per request — run in parallel
  const settled = await Promise.allSettled(
    keywords.map((kw) =>
      post<Resp>('/serp/google/organic/live/advanced', [
        { keyword: kw, location_code: locationCode, language_code: 'en', depth: 10 },
      ]),
    ),
  )

  const result: Record<string, DfsPAAItem[]> = {}
  for (const outcome of settled) {
    if (outcome.status === 'rejected') continue
    for (const task of outcome.value?.tasks ?? []) {
      for (const r of task.result ?? []) {
        if (!r.keyword) continue
        const paaBlocks = r.items?.filter((i) => i.type === 'people_also_ask') ?? []
        const questions: DfsPAAItem[] = []
        let pos = 1
        for (const block of paaBlocks) {
          for (const q of block.items ?? []) {
            const text = q.title ?? q.featured_title
            if (text) questions.push({ question: text, serp_position: pos++ })
          }
        }
        result[r.keyword] = questions
      }
    }
  }

  return result
}

// ─── SERP Features (featured snippets on near-ranking queries) ────────────────

export interface DfsSerpFeatureItem {
  keyword: string
  search_volume: number | null
  has_featured_snippet: boolean
  client_position: number | null
}

export async function getSerpFeatures(
  keywords: string[],
  clientDomain: string,
  locationCode = 2826,
): Promise<DfsSerpFeatureItem[]> {
  if (!keywords.length) return []

  type Resp = {
    tasks?: Array<{
      result?: Array<{
        keyword: string
        search_volume?: number
        items?: Array<{ type: string; domain?: string; rank_absolute?: number }>
      }>
    }>
  }

  // /live endpoints only accept ONE task per request — run in parallel, cap at 10
  const batch = keywords.slice(0, 10)
  const settled = await Promise.allSettled(
    batch.map((kw) =>
      post<Resp>('/serp/google/organic/live/regular', [
        { keyword: kw, location_code: locationCode, language_code: 'en' },
      ]),
    ),
  )

  const results: DfsSerpFeatureItem[] = []
  for (const outcome of settled) {
    if (outcome.status === 'rejected') continue
    for (const task of outcome.value?.tasks ?? []) {
      for (const r of task.result ?? []) {
        if (!r.keyword) continue
        const hasFeaturedSnippet = r.items?.some((i) => i.type === 'featured_snippet') ?? false
        const clientItem = r.items?.find((i) => i.domain?.includes(clientDomain))
        results.push({
          keyword: r.keyword,
          search_volume: r.search_volume ?? null,
          has_featured_snippet: hasFeaturedSnippet,
          client_position: clientItem?.rank_absolute ?? null,
        })
      }
    }
  }

  return results
}

// ─── Keyword Trends / Seasonal ────────────────────────────────────────────────

export interface DfsTrendItem {
  keyword: string
  monthly_searches: DfsSeasonalPoint[]
  search_volume: number | null
  growth_pct: number | null
}

export async function getKeywordTrends(
  keywords: string[],
  locationCode = 2826,
): Promise<DfsTrendItem[]> {
  if (!keywords.length) return []

  type Resp = {
    tasks?: Array<{
      result?: Array<{
        keyword: string
        search_volume?: number
        monthly_searches?: DfsSeasonalPoint[]
      }>
    }>
  }

  // This endpoint takes keywords as a plural array in a single task,
  // not one task per keyword. Filter out any blank strings first.
  const cleanKeywords = keywords.filter((k) => typeof k === 'string' && k.trim().length > 0)
  if (!cleanKeywords.length) return []

  const dateFrom = (() => {
    const d = new Date()
    d.setFullYear(d.getFullYear() - 1)
    return d.toISOString().slice(0, 7) + '-01'
  })()

  const body = [{
    keywords: cleanKeywords,
    location_code: locationCode,
    language_code: 'en',
    date_from: dateFrom,
  }]

  const data = await post<Resp>('/keywords_data/google_ads/search_volume/live', body)
  const results: DfsTrendItem[] = []

  for (const task of data?.tasks ?? []) {
    for (const r of task.result ?? []) {
      const monthly = r.monthly_searches ?? []
      // Calculate growth: last 4 months vs prior 4 months
      // API returns {year, month, search_volume} — sort chronologically
      const sorted = [...monthly].sort((a, b) =>
        a.year !== b.year ? a.year - b.year : a.month - b.month,
      )
      const recent = sorted.slice(-4)
      const prior = sorted.slice(-8, -4)
      const recentAvg = recent.reduce((s, p) => s + p.search_volume, 0) / (recent.length || 1)
      const priorAvg = prior.reduce((s, p) => s + p.search_volume, 0) / (prior.length || 1)
      const growthPct = priorAvg > 0 ? ((recentAvg - priorAvg) / priorAvg) * 100 : null

      results.push({
        keyword: r.keyword,
        search_volume: r.search_volume ?? null,
        monthly_searches: monthly,
        growth_pct: growthPct !== null ? Math.round(growthPct) : null,
      })
    }
  }

  return results
}

// ─── PAA + AI Overview (combined SERP parse, zero extra API cost) ─────────────

export interface DfsSerpKeywordData {
  paaQuestions: DfsPAAItem[]
  hasAiOverview: boolean
  aiOverviewSnippet: string | null
}

export async function getPeopleAlsoAskWithAIOverview(
  keywords: string[],
  locationCode = 2826,
): Promise<Record<string, DfsSerpKeywordData>> {
  if (!keywords.length) return {}

  type AiOverviewItem = {
    type: string
    text?: string
    items?: Array<{ type: string; title?: string; featured_title?: string }>
  }

  type Resp = {
    tasks?: Array<{
      result?: Array<{
        keyword: string
        items?: Array<AiOverviewItem>
      }>
    }>
  }

  const settled = await Promise.allSettled(
    keywords.map((kw) =>
      post<Resp>('/serp/google/organic/live/advanced', [
        { keyword: kw, location_code: locationCode, language_code: 'en', depth: 10 },
      ]),
    ),
  )

  const result: Record<string, DfsSerpKeywordData> = {}

  for (const outcome of settled) {
    if (outcome.status === 'rejected') continue
    for (const task of outcome.value?.tasks ?? []) {
      for (const r of task.result ?? []) {
        if (!r.keyword) continue

        // Extract PAA
        const paaBlocks = r.items?.filter((i) => i.type === 'people_also_ask') ?? []
        const paaQuestions: DfsPAAItem[] = []
        let pos = 1
        for (const block of paaBlocks) {
          for (const q of block.items ?? []) {
            const text = q.title ?? q.featured_title
            if (text) paaQuestions.push({ question: text, serp_position: pos++ })
          }
        }

        // Extract AI Overview
        const aiOverviewItem = r.items?.find((i) => i.type === 'ai_overview') ?? null
        const hasAiOverview = aiOverviewItem !== null
        const aiOverviewSnippet = aiOverviewItem?.text ?? null

        result[r.keyword] = { paaQuestions, hasAiOverview, aiOverviewSnippet }
      }
    }
  }

  return result
}

// ─── Backlinks (new referring domains for a target) ───────────────────────────

export interface DfsBacklinkItem {
  domain_from: string
  domain_rank: number | null
  url_from: string
  url_to: string
  first_seen: string
}

export async function getNewBacklinks(
  targetDomain: string,
  dateFrom: string,
  limit = 20,
): Promise<DfsBacklinkItem[]> {
  type Resp = {
    tasks?: Array<{ result?: Array<{ items?: DfsBacklinkItem[] }> }>
  }
  const data = await post<Resp>('/backlinks/referring_domains/live', [
    {
      target: targetDomain,
      limit,
      filters: [['first_seen', '>=', dateFrom]],
      order_by: ['domain_rank,desc'],
    },
  ])
  return data?.tasks?.[0]?.result?.[0]?.items ?? []
}

// ─── Historical Rank Overview (domain-level ranking history) ─────────────────

export interface DfsRankHistoryItem {
  keyword: string
  position: number | null
  url: string | null
  search_volume: number | null
}

export async function getDomainRankSnapshot(
  domain: string,
  locationCode = 2826,
  limit = 100,
): Promise<DfsRankHistoryItem[]> {
  // Use ranked_keywords/live for per-keyword current positions
  // (historical_rank_overview gives aggregate domain metrics, not per-keyword positions)
  type Resp = {
    tasks?: Array<{
      result?: Array<{
        items?: Array<{
          keyword_data?: {
            keyword?: string
            keyword_info?: { search_volume?: number }
          }
          ranked_serp_element?: {
            serp_item?: { rank_absolute?: number; url?: string }
          }
        }>
      }>
    }>
  }
  const data = await post<Resp>('/dataforseo_labs/google/ranked_keywords/live', [
    {
      target: domain,
      location_code: locationCode,
      limit,
      order_by: ['ranked_serp_element.serp_item.rank_absolute,asc'],
    },
  ])
  const rankItems = data?.tasks?.[0]?.result?.[0]?.items ?? []
  return rankItems.map((item) => ({
    keyword: item.keyword_data?.keyword ?? '',
    position: item.ranked_serp_element?.serp_item?.rank_absolute ?? null,
    url: item.ranked_serp_element?.serp_item?.url ?? null,
    search_volume: item.keyword_data?.keyword_info?.search_volume ?? null,
  })).filter((i) => i.keyword)
}

// ─── Keyword Suggestions (expand seed keywords) ───────────────────────────────

export interface DfsKeywordSuggestion {
  keyword: string
  search_volume: number | null
  keyword_difficulty: number | null
  competition: number | null
}

export async function getKeywordSuggestions(
  seedKeywords: string[],
  locationCode = 2826,
  limitPerSeed = 50,
): Promise<DfsKeywordSuggestion[]> {
  if (!seedKeywords.length) return []

  // Batch all seeds into one request array (cost efficient)
  const batch = seedKeywords.slice(0, 15) // hard cap: 15 seeds per run
  type SuggestResp = {
    tasks?: Array<{
      result?: Array<{
        items?: Array<{
          keyword_data?: {
            keyword?: string
            keyword_info?: {
              search_volume?: number
              keyword_difficulty?: number
              competition?: number
            }
          }
        }>
      }>
    }>
  }

  const settled = await Promise.allSettled(
    batch.map((seed) =>
      post<SuggestResp>('/dataforseo_labs/google/keyword_suggestions/live', [
        {
          keyword: seed,
          location_code: locationCode,
          language_name: 'English',
          limit: limitPerSeed,
          filters: [
            ['keyword_data.keyword_info.search_volume', '>', 50],
            'and',
            ['keyword_data.keyword_info.keyword_difficulty', '<', 70],
          ],
        },
      ]),
    ),
  )

  const seen = new Set<string>()
  const results: DfsKeywordSuggestion[] = []

  for (const outcome of settled) {
    if (outcome.status === 'rejected') continue
    for (const task of outcome.value?.tasks ?? []) {
      for (const r of task.result ?? []) {
        for (const item of r.items ?? []) {
          const kw = item.keyword_data?.keyword
          if (!kw || seen.has(kw)) continue
          seen.add(kw)
          results.push({
            keyword: kw,
            search_volume: item.keyword_data?.keyword_info?.search_volume ?? null,
            keyword_difficulty: item.keyword_data?.keyword_info?.keyword_difficulty ?? null,
            competition: item.keyword_data?.keyword_info?.competition ?? null,
          })
        }
      }
    }
  }

  return results.slice(0, 200) // hard cap: 200 total keywords forward
}

// ─── Live per-keyword rank check (true SERP positions) ────────────────────────

export interface LiveRankItem {
  keyword: string
  position: number | null // rank_absolute of our domain, or null if not in top 100
  url: string | null
}

/**
 * Checks the live Google SERP for each keyword and returns OUR domain's actual
 * position (rank_absolute) and the ranking URL. Unlike DataForSEO Labs
 * ranked_keywords (which only knows keywords a domain already ranks for in its
 * index), this works for any site and any chosen keyword — the right tool for
 * tracking specific target keywords. One task per keyword, run in parallel.
 *
 * Cost note: 1 SERP request per keyword. Callers must cap the input list.
 */
export async function getLiveDomainRankings(
  keywords: string[],
  domain: string,
  locationCode = 2826,
  device: 'desktop' | 'mobile' = 'desktop',
): Promise<Map<string, LiveRankItem>> {
  const out = new Map<string, LiveRankItem>()
  if (!keywords.length) return out

  type Resp = {
    tasks?: Array<{
      result?: Array<{
        keyword?: string
        items?: Array<{ type?: string; domain?: string; url?: string; rank_absolute?: number }>
      }>
    }>
  }

  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')

  const settled = await Promise.allSettled(
    keywords.map((kw) =>
      post<Resp>('/serp/google/organic/live/regular', [
        { keyword: kw, location_code: locationCode, language_code: 'en', device },
      ]),
    ),
  )

  for (const outcome of settled) {
    if (outcome.status === 'rejected') continue
    for (const task of outcome.value?.tasks ?? []) {
      for (const r of task.result ?? []) {
        if (!r.keyword) continue
        const match = (r.items ?? []).find(
          (i) => i.type === 'organic' && i.domain?.replace(/^www\./, '').includes(cleanDomain),
        )
        out.set(r.keyword.toLowerCase(), {
          keyword: r.keyword.toLowerCase(),
          position: match?.rank_absolute ?? null,
          url: match?.url ?? null,
        })
      }
    }
  }

  return out
}
