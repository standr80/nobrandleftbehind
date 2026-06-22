import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

type Db = SupabaseClient<Database>

/** CORS: the embed must work from any origin; content is public. */
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, If-None-Match',
}

/**
 * Shared, edge-cacheable content for the hot public paths (unparameterised
 * list, single post, theme). `?since=` responses override this with a short
 * private TTL since they are consumer-specific.
 */
export const PUBLIC_CACHE = 'public, s-maxage=300, stale-while-revalidate=86400'
export const PRIVATE_CACHE = 'private, max-age=30'

/**
 * Negative / non-live responses (404 Not Found, 410 Gone, tenant-not-found).
 * These must NOT be edge-cached: a "not found" for a slug that is about to be
 * published would otherwise stick around for the PUBLIC_CACHE window and get
 * baked into a consumer's rebuilt static site, 404-ing a live article.
 */
export const NO_STORE = 'no-store'

/**
 * Cache tag applied (via the `Cache-Tag` response header) to every public,
 * edge-cacheable content response for a tenant — list, single post, tags and
 * theme. On publish/unpublish the deploy hook calls `revalidateTag` with this
 * same tag, so Vercel purges the tenant's cached responses immediately instead
 * of waiting out the PUBLIC_CACHE window. Keep the header and the purge in sync.
 */
export function contentTag(tenantId: string): string {
  return `content-${tenantId}`
}

/** Derive a slug from a domain: "www.designsonprint.com" -> "designsonprint" */
export function domainToSlug(domain: string): string {
  return domain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('.')[0]
    .toLowerCase()
}

export interface ResolvedTenant {
  id: string
  name: string
  domain: string
  blog_theme: unknown
  blog_footer: string | null
}

/**
 * Resolve a tenant by its public slug.
 *
 * Migration-tolerant: prefers an exact match on `tenants.public_slug`
 * (migration 025). If that column does not exist yet, or no row matches,
 * falls back to the legacy domain-substring + derived-slug behaviour so
 * existing /api/feed consumers keep working before/after the migration.
 */
export async function resolveTenant(db: Db, slug: string): Promise<ResolvedTenant | null> {
  const wanted = slug.toLowerCase()

  // 1. Exact public_slug match (post-migration, indexed, collision-free).
  const exact = await db
    .from('tenants')
    .select('id, name, domain, blog_theme, blog_footer')
    .eq('public_slug', wanted)
    .maybeSingle()

  if (!exact.error && exact.data) return exact.data as ResolvedTenant

  // 2. Legacy fallback: domain substring then exact derived-slug match.
  const { data: rows, error } = await db
    .from('tenants')
    .select('id, name, domain, blog_theme, blog_footer')
    .ilike('domain', `%${wanted}%`)
    .limit(20)

  if (error || !rows) return null
  return (rows.find((t) => domainToSlug(t.domain) === wanted) as ResolvedTenant) ?? null
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/** Columns selected for list/summary responses. */
export const SUMMARY_COLUMNS =
  'id, title, slug, excerpt, meta_description, tags, hero_image_url, hero_image_alt, hero_image_credit, created_by, published_at, updated_at, deleted_at, status, author:authors(name, job_title, bio, links, slug)'

/** Same as summary plus the body for single-post responses. */
export const POST_COLUMNS = `${SUMMARY_COLUMNS}, body_mdx`

export interface RawPost {
  id: string
  title: string | null
  slug: string | null
  excerpt: string | null
  meta_description: string | null
  tags: string[] | null
  hero_image_url: string | null
  hero_image_alt: string | null
  hero_image_credit: string | null
  created_by: string | null
  published_at: string | null
  updated_at: string | null
  deleted_at: string | null
  status: string | null
  body_mdx?: string | null
  author?: AuthorRow | AuthorRow[] | null
}

export interface AuthorRow {
  name: string | null
  job_title: string | null
  bio: string | null
  links: unknown
  slug: string | null
}

/** Supabase may return an embedded to-one relation as an object or a 1-element array. */
function pickAuthor(a: RawPost['author']): AuthorRow | null {
  if (!a) return null
  return Array.isArray(a) ? a[0] ?? null : a
}

interface AuthorLink {
  label: string
  url: string
}

function authorLinks(a: AuthorRow | null): AuthorLink[] {
  if (!a || !Array.isArray(a.links)) return []
  return (a.links as unknown[])
    .filter((l): l is AuthorLink => !!l && typeof l === 'object' && typeof (l as AuthorLink).url === 'string')
    .map((l) => ({ label: String(l.label ?? '').trim(), url: String(l.url).trim() }))
}

function postUrl(domain: string, slug: string): string {
  const clean = domain.replace(/^https?:\/\//, '').replace(/\/$/, '')
  return `https://${clean}/blog/${slug}`
}

/** A row that is unpublished or soft-deleted becomes a tombstone. */
export function isLive(p: RawPost): boolean {
  return p.status === 'published' && !p.deleted_at
}

export function toTombstone(p: RawPost) {
  return {
    id: p.id,
    slug: p.slug ?? '',
    deleted: true as const,
    updated_at: p.updated_at ?? '',
  }
}

/** The tenant's default author, used when a post has none attributed. */
export async function getDefaultAuthor(db: Db, tenantId: string): Promise<AuthorRow | null> {
  const { data } = await db
    .from('authors')
    .select('name, job_title, bio, links, slug')
    .eq('tenant_id', tenantId)
    .eq('is_default', true)
    .maybeSingle()
  return (data as AuthorRow | null) ?? null
}

export function toSummary(p: RawPost, domain: string, fallbackAuthor: AuthorRow | null = null) {
  const a = pickAuthor(p.author) || fallbackAuthor
  return {
    id: p.id,
    title: p.title ?? '',
    slug: p.slug ?? '',
    excerpt: p.excerpt ?? '',
    meta_description: p.meta_description ?? '',
    tags: p.tags ?? [],
    hero_image: p.hero_image_url ?? '',
    hero_image_alt: p.hero_image_alt ?? '',
    hero_image_credit: p.hero_image_credit ?? '',
    // `author` stays a plain name string for backward compatibility; the
    // richer fields below carry the E-E-A-T signal (bio, credentials, sameAs).
    author: (a && a.name) || p.created_by || 'Clem',
    author_title: a?.job_title ?? '',
    author_slug: a?.slug ?? '',
    published_at: p.published_at ?? '',
    updated_at: p.updated_at ?? '',
    url: postUrl(domain, p.slug ?? ''),
  }
}

export function toPost(p: RawPost, domain: string, bodyHtml: string, fallbackAuthor: AuthorRow | null = null) {
  const a = pickAuthor(p.author) || fallbackAuthor
  return {
    ...toSummary(p, domain, fallbackAuthor),
    author_bio: a?.bio ?? '',
    author_links: authorLinks(a),
    body_html: bodyHtml,
    body_format: 'html' as const,
  }
}

// ---------------------------------------------------------------------------
// ETag / conditional GET
// ---------------------------------------------------------------------------

export function etagFor(payload: unknown): string {
  const hash = createHash('sha1').update(JSON.stringify(payload)).digest('hex')
  return `"${hash}"`
}

/** True when the client's If-None-Match matches — caller should 304. */
export function notModified(req: Request, etag: string): boolean {
  const inm = req.headers.get('if-none-match')
  return inm !== null && inm.split(',').map((s) => s.trim()).includes(etag)
}
