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
    throw new Error(`DataForSEO ${path} failed: ${res.status} ${text}`)
  }
  return res.json() as Promise<T>
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
  date: string
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

  const body = keywords.map((kw) => ({
    keyword: kw,
    location_code: locationCode,
    depth: 3,
  }))

  const data = await post<Resp>('/serp/google/organic/live/advanced', body)
  const result: Record<string, DfsPAAItem[]> = {}

  for (const task of data?.tasks ?? []) {
    for (const r of task.result ?? []) {
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

  const body = keywords.map((kw) => ({
    keyword: kw,
    location_code: locationCode,
    depth: 10,
  }))

  const data = await post<Resp>('/serp/google/organic/live/regular', body)
  const results: DfsSerpFeatureItem[] = []

  for (const task of data?.tasks ?? []) {
    for (const r of task.result ?? []) {
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

  const body = keywords.map((kw) => ({
    keyword: kw,
    location_code: locationCode,
    date_from: (() => {
      const d = new Date()
      d.setFullYear(d.getFullYear() - 1)
      return d.toISOString().slice(0, 7) + '-01'
    })(),
  }))

  const data = await post<Resp>('/keywords_data/google_ads/search_volume/live', body)
  const results: DfsTrendItem[] = []

  for (const task of data?.tasks ?? []) {
    for (const r of task.result ?? []) {
      const monthly = r.monthly_searches ?? []
      // Calculate growth: last 4 weeks vs same 4 weeks prior year
      const sorted = [...monthly].sort((a, b) => a.date.localeCompare(b.date))
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
