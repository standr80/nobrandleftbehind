// Pam stage 2 — the recommendation engine (v1, no GSC).
//
// Signals: seasonal Scout opportunities, cadence adherence, content
// staleness, cluster coverage, FAQ question pool. Each candidate carries a
// one-sentence reason + evidence (incl. a dedupe_key so Pam never repeats
// herself). GSC decay signals join as stage 4 once credentials exist.
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

const CADENCE_DAYS: Record<string, number> = {
  daily: 1,
  weekly: 7,
  fortnightly: 14,
  biweekly: 14,
  monthly: 30,
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
}

export async function runPamEngine(tenantId: string): Promise<PamRunResult> {
  const db = createAdminClient()
  const now = Date.now()
  const daysAgo = (iso: string | null) => (iso ? (now - new Date(iso).getTime()) / 86400000 : Infinity)

  const [{ data: tenant }, { data: posts }, { data: faqPool }, { data: opps }, { data: existing }] =
    await Promise.all([
      db.from('tenants').select('publish_cadence, content_clusters').eq('id', tenantId).single(),
      db
        .from('blog_posts')
        .select('id, title, content_type, status, published_at, last_refreshed_at, cluster_id')
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
    ])

  const published = (posts ?? []).filter((p) => p.status === 'published' && p.published_at)

  // ── Dedupe map: dedupe_key → most-blocking prior state ────────────────────
  // open/scheduled/snoozed → skip; dismissed recently → skip; done → allow.
  const blockedKeys = new Set<string>()
  for (const item of existing ?? []) {
    const key = (item.evidence as { dedupe_key?: string } | null)?.dedupe_key
    if (!key) continue
    if (['open', 'scheduled', 'snoozed'].includes(item.status)) blockedKeys.add(key)
    else if (item.status === 'dismissed' && daysAgo(item.dismissed_at) < RESUGGEST_DAYS) {
      blockedKeys.add(key)
    }
  }

  const candidates: Candidate[] = []

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

  // ── 2. Cadence adherence ──────────────────────────────────────────────────
  const cadenceDays = CADENCE_DAYS[tenant?.publish_cadence ?? ''] ?? null
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
        priority: 2,
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
  }

  // ── Dedupe + cap + insert ─────────────────────────────────────────────────
  const fresh = candidates.filter((c) => !blockedKeys.has(c.evidence.dedupe_key))
  const skippedExisting = candidates.length - fresh.length

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

  return {
    created: toInsert.length,
    considered: candidates.length,
    skippedExisting,
    cappedOut: fresh.length - toInsert.length,
  }
}
