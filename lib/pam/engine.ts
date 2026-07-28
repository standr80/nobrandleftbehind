// Pam — the recommendation engine.
//
// Signals: seasonal Scout opportunities, GSC click/position decay (the
// strongest refresh trigger), cadence adherence, content staleness, cluster
// coverage, FAQ question pool. Each candidate carries a one-sentence reason
// + evidence (incl. a dedupe_key so Pam never repeats herself).
//
// Rules (binding, from the spec):
//  - few and high-confidence: hard cap on open recommendations
//  - dismissals persist: a dismissed key is not re-suggested for RESUGGEST_DAYS
//  - done items may recur naturally (a refreshed post can go stale again)

import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/supabase/types'

const REFRESH_AGE_DAYS = 270 // ~9 months without publish/refresh → stale
const MAX_OPEN_RECOMMENDATIONS = 5
const SEASONAL_MAX_WEEKS = 10 // recommend ahead of the peak, not during it
const RESUGGEST_DAYS = 21 // dismissed keys stay quiet this long

const DECAY_MIN_PRIOR_CLICKS = 20 // below this, drops are noise
const DECAY_MIN_DROP = 0.3 // 30%+ click decline over 4 weeks

const CADENCE_DAYS: Record<string, number> = {
  daily: 1,
  weekly: 7,
  'twice-weekly': 3.5,
  fortnightly: 14,
  biweekly: 14,
  monthly: 30,
}

/** Parse a publish cadence into days-between-posts. Accepts the named
 *  cadences plus the "Npw" (N posts per week) shorthand, e.g. "2pw" → 3.5. */
function cadenceToDays(cadence: string | null | undefined): number | null {
  if (!cadence) return null
  const named = CADENCE_DAYS[cadence.toLowerCase().trim()]
  if (named) return named
  const perWeek = /^(\d+)\s*pw$/i.exec(cadence.trim())
  if (perWeek && Number(perWeek[1]) > 0) return 7 / Number(perWeek[1])
  return null
}

interface Candidate {
  item_type: 'post' | 'faq' | 'gallery' | 'refresh' | 'other'
  title: string
  reason: string
  evidence: { dedupe_key: string; signal: string } & Record<string, unknown>
  target_post_id?: string | null
  priority: number // lower = more urgent when trimming to the cap
}

export interface PamRunResult {
  created: number
  considered: number
  skippedExisting: number
  cappedOut: number
  /** Per-signal explanations so an empty run is never opaque. */
  notes: string[]
}

/** gsc_page_stats can exceed Supabase's 1000-row response cap for large
 *  sites (Putterfingers: ~1.8k URLs × 8 weeks) — page through it. */
async function fetchGscStats(
  db: ReturnType<typeof createAdminClient>,
  tenantId: string,
  sinceWeek: string,
): Promise<Array<{ url: string; week_start: string; clicks: number; position: number | null }>> {
  const all: Array<{ url: string; week_start: string; clicks: number; position: number | null }> = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('gsc_page_stats')
      .select('url, week_start, clicks, position')
      .eq('tenant_id', tenantId)
      .gte('week_start', sinceWeek)
      .order('week_start', { ascending: false })
      .order('url', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`[pam] gsc fetch failed: ${error.message}`)
    all.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
  return all
}

export async function runPamEngine(tenantId: string): Promise<PamRunResult> {
  const db = createAdminClient()
  const now = Date.now()
  const daysAgo = (iso: string | null) => (iso ? (now - new Date(iso).getTime()) / 86400000 : Infinity)

  // Fetch 10 weeks so the recent-4 vs prior-4 comparison always has its 8
  // complete ISO weeks regardless of which weekday the run lands on.
  const statsWindowStart = new Date(now - 10 * 7 * 86400000).toISOString().slice(0, 10)
  const [
    { data: tenant },
    { data: posts },
    { data: faqPool },
    { data: opps },
    { data: existing },
    { data: gscStats },
  ] = await Promise.all([
      db.from('tenants').select('publish_cadence, content_clusters').eq('id', tenantId).single(),
      db
        .from('blog_posts')
        .select('id, title, content_type, status, published_at, last_refreshed_at, cluster_id, shopify_article_url')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null),
      db
        .from('faq_questions')
        .select('id')
        .eq('tenant_id', tenantId)
        .is('used_in_post_id', null),
      db
        .from('scout_keyword_opportunities')
        .select('keyword, seasonal_peak_month, weeks_until_peak, status')
        .eq('tenant_id', tenantId)
        .eq('status', 'pending'),
      db
        .from('pam_items')
        .select('kind, status, evidence, dismissed_at')
        .eq('tenant_id', tenantId),
      fetchGscStats(db, tenantId, statsWindowStart).then((data) => ({ data })),
    ])

  const published = (posts ?? []).filter((p) => p.status === 'published' && p.published_at)

  // ── Dedupe map: dedupe_key → most-blocking prior state ────────────────────
  // open/scheduled/snoozed → skip; dismissed recently → skip; done → allow.
  const blockedKeys = new Set<string>()
  for (const item of existing ?? []) {
    const key = (item.evidence as { dedupe_key?: string } | null)?.dedupe_key
    if (!key) continue
    // Deferred = "not now, don't forget" — blocks re-suggestion while parked.
    if (['open', 'scheduled', 'snoozed', 'deferred'].includes(item.status)) blockedKeys.add(key)
    else if (item.status === 'dismissed' && daysAgo(item.dismissed_at) < RESUGGEST_DAYS) {
      blockedKeys.add(key)
    }
  }

  const candidates: Candidate[] = []
  const notes: string[] = []

  // ── 1. Seasonal Scout opportunities (most time-sensitive) ─────────────────
  const seasonal = (opps ?? [])
    .filter(
      (o) =>
        o.weeks_until_peak !== null && o.weeks_until_peak > 0 && o.weeks_until_peak <= SEASONAL_MAX_WEEKS,
    )
    .sort((a, b) => (a.weeks_until_peak ?? 99) - (b.weeks_until_peak ?? 99))
    .slice(0, 2)
  for (const o of seasonal) {
    candidates.push({
      item_type: 'post',
      title: `Publish for "${o.keyword}" ahead of its seasonal peak`,
      reason: `Scout says search interest in "${o.keyword}" peaks in ~${o.weeks_until_peak} weeks — publishing now gives it time to rank.`,
      evidence: {
        signal: 'seasonal',
        dedupe_key: `seasonal:${o.keyword}`,
        keyword: o.keyword,
        weeks_until_peak: o.weeks_until_peak,
        peak_month: o.seasonal_peak_month,
      },
      priority: 1,
    })
  }
  if (!seasonal.length) {
    notes.push(
      (opps ?? []).length
        ? 'Seasonal: no Scout keyword peaks within the next 10 weeks.'
        : 'Seasonal: no pending Scout keyword opportunities — run Scout to gather some.',
    )
  }

  // ── 1b. GSC decay (the strongest refresh trigger — needs stage-4 sync) ────
  if (gscStats?.length) {
    // Split the last 8 ISO weeks into recent 4 vs prior 4 per URL.
    const weeks = Array.from(new Set(gscStats.map((r) => r.week_start))).sort().reverse()
    const recentWeeks = new Set(weeks.slice(0, 4))
    const priorWeeks = new Set(weeks.slice(4, 8))
    const byUrl = new Map<
      string,
      { recent: number; prior: number; posRecentW: number; posRecentN: number; posPriorW: number; posPriorN: number }
    >()
    for (const r of gscStats) {
      const agg =
        byUrl.get(r.url) ?? { recent: 0, prior: 0, posRecentW: 0, posRecentN: 0, posPriorW: 0, posPriorN: 0 }
      if (recentWeeks.has(r.week_start)) {
        agg.recent += r.clicks
        if (r.position !== null) { agg.posRecentW += r.position; agg.posRecentN += 1 }
      } else if (priorWeeks.has(r.week_start)) {
        agg.prior += r.clicks
        if (r.position !== null) { agg.posPriorW += r.position; agg.posPriorN += 1 }
      }
      byUrl.set(r.url, agg)
    }

    const normalise = (u: string | null) =>
      (u ?? '').replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()
    const postByUrl = new Map(
      published
        .filter((p) => p.shopify_article_url)
        .map((p) => [normalise(p.shopify_article_url), p] as const),
    )

    const decays = Array.from(byUrl.entries())
      .map(([url, a]) => ({
        url,
        recent: a.recent,
        prior: a.prior,
        drop: a.prior > 0 ? (a.prior - a.recent) / a.prior : 0,
        posRecent: a.posRecentN ? a.posRecentW / a.posRecentN : null,
        posPrior: a.posPriorN ? a.posPriorW / a.posPriorN : null,
      }))
      .filter((d) => d.prior >= DECAY_MIN_PRIOR_CLICKS && d.drop >= DECAY_MIN_DROP)
      .sort((a, b) => b.prior * b.drop - a.prior * a.drop)
      .slice(0, 2)

    for (const d of decays) {
      const post = postByUrl.get(normalise(d.url))
      const posNote =
        d.posPrior !== null && d.posRecent !== null && d.posRecent - d.posPrior > 0.5
          ? ` and average position slipped ${d.posPrior.toFixed(1)} → ${d.posRecent.toFixed(1)}`
          : ''
      const pageLabel = post ? post.title : d.url.replace(/^https?:\/\/[^/]+/, '')
      candidates.push({
        item_type: post ? 'refresh' : 'other',
        title: `Refresh: ${pageLabel}`,
        reason: `Search clicks fell ${Math.round(d.drop * 100)}% over the last month (${d.prior} → ${d.recent})${posNote} — this page is decaying.`,
        evidence: {
          signal: 'gsc_decay',
          dedupe_key: post ? `refresh:${post.id}` : `decay:${d.url}`,
          url: d.url,
          clicks_prior_4w: d.prior,
          clicks_recent_4w: d.recent,
          drop_pct: Math.round(d.drop * 100),
          position_prior: d.posPrior,
          position_recent: d.posRecent,
        },
        target_post_id: post?.id ?? null,
        priority: 2,
      })
    }
    const analysedUrls = byUrl.size
    if (!decays.length) {
      notes.push(
        weeks.length < 8
          ? `Decay: only ${weeks.length} weeks of GSC history so far — needs 8 for a fair before/after comparison.`
          : `Decay: analysed ${analysedUrls} pages — none crossed the threshold (20+ clicks/month then a 30%+ drop). Healthy sign.`,
      )
    }
  } else {
    notes.push('Decay: no GSC data — connect Search Console in Scout settings and sync.')
  }

  // ── 2. Cadence adherence ──────────────────────────────────────────────────
  const cadenceDays = cadenceToDays(tenant?.publish_cadence)
  if (!cadenceDays) {
    notes.push(
      tenant?.publish_cadence
        ? `Cadence: unrecognised cadence "${tenant.publish_cadence}" — expected daily/weekly/fortnightly/monthly or Npw (e.g. 2pw).`
        : 'Cadence: no publish cadence set in workspace settings, so slippage can’t be measured.',
    )
  }
  if (cadenceDays) {
    const lastPublished = published
      .map((p) => p.published_at as string)
      .sort()
      .pop()
    const gap = lastPublished ? Math.floor(daysAgo(lastPublished)) : null
    if (gap !== null && gap > cadenceDays * 1.5) {
      candidates.push({
        item_type: 'post',
        title: 'Get back on your publishing cadence',
        reason: `Last publish was ${gap} days ago against a ${tenant?.publish_cadence} cadence — the schedule has slipped.`,
        evidence: {
          signal: 'cadence',
          dedupe_key: 'cadence',
          days_since_last_publish: gap,
          cadence: tenant?.publish_cadence,
        },
        priority: 3,
      })
    }
  }

  // ── 3. Staleness → refresh (oldest two beyond the threshold) ──────────────
  const stale = published
    .map((p) => ({
      post: p,
      age: Math.floor(daysAgo(p.last_refreshed_at ?? p.published_at)),
    }))
    .filter((s) => s.age > REFRESH_AGE_DAYS)
    .sort((a, b) => b.age - a.age)
    .slice(0, 2)
  for (const s of stale) {
    const months = Math.round(s.age / 30)
    candidates.push({
      item_type: 'refresh',
      title: `Refresh: ${s.post.title}`,
      reason: `Published ${months} months ago and never refreshed — dated content slowly loses rankings and trust.`,
      evidence: {
        signal: 'staleness',
        dedupe_key: `refresh:${s.post.id}`,
        age_days: s.age,
        content_type: s.post.content_type,
      },
      target_post_id: s.post.id,
      priority: 3,
    })
  }
  if (!stale.length) {
    notes.push(
      published.length
        ? 'Staleness: nothing published more than 9 months ago without a refresh.'
        : 'Staleness: no published content yet.',
    )
  }

  // ── 4. Cluster coverage ───────────────────────────────────────────────────
  const clusters = Array.isArray(tenant?.content_clusters)
    ? (tenant!.content_clusters as Array<{ name?: string }>).filter((c) => c?.name)
    : []
  const countByCluster: Record<string, number> = {}
  for (const p of published) {
    if (p.cluster_id) countByCluster[p.cluster_id] = (countByCluster[p.cluster_id] ?? 0) + 1
  }
  const thin = clusters
    .map((c) => ({ name: c.name as string, count: countByCluster[c.name as string] ?? 0 }))
    .filter((c) => c.count < 2)
    .sort((a, b) => a.count - b.count)
    .slice(0, 2)
  for (const c of thin) {
    candidates.push({
      item_type: 'post',
      title: `Add supporting content to the "${c.name}" cluster`,
      reason: `The "${c.name}" cluster has ${c.count === 0 ? 'no' : 'only one'} published piece${c.count === 1 ? '' : 's'} — its money page has little internal linking to draw on.`,
      evidence: {
        signal: 'cluster_coverage',
        dedupe_key: `cluster:${c.name}`,
        cluster: c.name,
        published_count: c.count,
      },
      priority: 4,
    })
  }
  if (!clusters.length) {
    notes.push('Clusters: no content clusters configured in Settings — coverage checks can’t run.')
  } else if (!thin.length) {
    notes.push('Clusters: every cluster has 2+ supporting pieces.')
  }

  // ── 5. FAQ question pool ──────────────────────────────────────────────────
  const unusedQuestions = (faqPool ?? []).length
  if (unusedQuestions >= 5) {
    candidates.push({
      item_type: 'faq',
      title: `Assemble an FAQ page from ${unusedQuestions} waiting questions`,
      reason: `${unusedQuestions} collected customer questions are sitting unused — enough for a new FAQ page with rich-result schema.`,
      evidence: {
        signal: 'faq_pool',
        dedupe_key: 'faq_pool',
        unused_questions: unusedQuestions,
      },
      priority: 5,
    })
  } else {
    notes.push(
      `FAQ pool: ${unusedQuestions} unused question${unusedQuestions === 1 ? '' : 's'} waiting (needs 5+ for a page).`,
    )
  }

  // ── Dedupe + cap + insert ─────────────────────────────────────────────────
  const fresh = candidates.filter((c) => !blockedKeys.has(c.evidence.dedupe_key))
  const skippedExisting = candidates.length - fresh.length

  // Deferred items don't count against the desk cap — they're parked, and
  // parking shouldn't starve the desk of fresh recommendations.
  const currentOpen = (existing ?? []).filter(
    (i) => i.kind === 'recommendation' && ['open', 'scheduled', 'snoozed'].includes(i.status),
  ).length
  const room = Math.max(0, MAX_OPEN_RECOMMENDATIONS - currentOpen)
  const toInsert = fresh.sort((a, b) => a.priority - b.priority).slice(0, room)

  if (toInsert.length) {
    const generatedAt = new Date().toISOString()
    const { error } = await db.from('pam_items').insert(
      toInsert.map((c) => ({
        tenant_id: tenantId,
        kind: 'recommendation',
        source: 'pam',
        status: 'open',
        item_type: c.item_type,
        title: c.title,
        reason: c.reason,
        evidence: { ...c.evidence, generated_at: generatedAt } as unknown as Json,
        target_post_id: c.target_post_id ?? null,
      })),
    )
    if (error) throw new Error(`[pam] insert failed: ${error.message}`)
  }

  if (skippedExisting > 0) {
    notes.push(`${skippedExisting} candidate${skippedExisting === 1 ? '' : 's'} already on the desk or recently dismissed.`)
  }

  return {
    created: toInsert.length,
    considered: candidates.length,
    skippedExisting,
    cappedOut: fresh.length - toInsert.length,
    notes,
  }
}
