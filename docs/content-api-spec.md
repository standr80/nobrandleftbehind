# NBLB Content API — v1 Spec

Status: draft for build. Owner: Richard. Last updated: 2026-06-16.

## Purpose

A public, read-only, per-tenant HTTP API that exposes published blog posts so any
client integration — the JavaScript embed, the WordPress plugin, Webflow/Shopify
sync, future channels — consumes one stable contract instead of touching Supabase
directly. This is the foundation everything else sits on.

## What already exists

Two routes already implement a first cut and should be treated as v0:

- `GET /api/feed/[tenantSlug]` — list of published posts (metadata only)
- `GET /api/feed/[tenantSlug]/[slug]` — single post incl. `body_html` (MDX rendered via `lib/mdx/toHtml`)

Both use `createAdminClient()` (service role, bypasses RLS), wildcard CORS, and
`Cache-Control: no-store`. v1 keeps these working and adds the hardening below.
Recommend aliasing the new contract under `/api/content/v1/...` and keeping
`/api/feed/...` as a thin redirect/alias during transition.

## The five gaps v0 has, and why they block the roadmap

1. **Slug identity is fragile.** `domainToSlug()` does `ilike '%tenantSlug%'` then
   matches the first domain label. Two tenants whose domains share a substring can
   collide, and the lookup is O(scan). There is no dedicated tenant slug column.
   → Add `tenants.public_slug text unique`.

2. **No stable post identity.** Posts are addressable only by `slug`, but slugs can
   change. A consumer (esp. the WordPress plugin) needs a stable key to map and
   dedupe imports. → Expose `blog_posts.id` as `id`.

3. **No incremental sync.** The list returns every published post, every time, with
   no `updated_at` and no `?since=`. A push/cron consumer can't ask "what changed
   since my last pull." → Expose `updated_at`; support `?since=` and pagination.

4. **No deletion/unpublish signal (tombstones).** When a post is unpublished or
   deleted it simply vanishes from the feed. A consumer that already imported it
   can't tell it should be removed. → Expose tombstones so sync can mirror deletes.

5. **No caching / abuse control.** `no-store` forfeits all edge caching (every embed
   pageview hits Supabase), and wildcard CORS with no rate limit is an open door.
   → Add `s-maxage` + `stale-while-revalidate`, ETags, and per-tenant rate limiting.

## Endpoints (v1)

Base path: `https://api.nobrandleftbehind.com/content/v1` (or app-hosted at
`/api/content/v1` — same handlers; the public hostname is a CNAME/proxy decision).

### `GET /tenants/{slug}/posts`

List published posts for a tenant, newest first.

Query params:

- `since` — ISO-8601 timestamp. Returns posts with `updated_at > since`, **including
  tombstones** for posts unpublished/deleted after that time. Drives incremental sync.
- `limit` — default 50, max 100.
- `cursor` — opaque pagination cursor (keyset on `(updated_at, id)`), returned as
  `next_cursor` when more results exist.
- `tag` — optional filter to a single tag.
- `include` — `theme` to also return the tenant's brand/nav block (see below).

Response:

```json
{
  "tenant": "designsonprint",
  "name": "Designs on Print",
  "site_url": "https://designsonprint.com",
  "generated_at": "2026-06-16T10:00:00Z",
  "next_cursor": null,
  "posts": [ { /* PostSummary */ } ],
  "theme": { /* present only when include=theme */ }
}
```

### `GET /tenants/{slug}/posts/{slug-or-id}`

Single post, including rendered `body_html`. Accepts either the post slug or its
UUID `id` (so a consumer that stored the id still resolves the post after a slug
change). Returns `410 Gone` with a tombstone body if the post existed but is no
longer published.

### `GET /tenants/{slug}/theme`

Brand tokens + navigation for the embed/plugin to match the client's site:
`blog_theme` jsonb (primaryColor, backgroundColor, textColor, headingFont, bodyFont,
logoUrl, logoAlt, navLinks[]) and `blog_footer`. Cheap, highly cacheable.

### `OPTIONS *`

CORS preflight, 204.

## Data shapes

### PostSummary (list)

| field | source | notes |
|---|---|---|
| `id` | `blog_posts.id` | stable UUID — the sync key |
| `title` | `title` | |
| `slug` | `slug` | unique per tenant; may change |
| `excerpt` | `excerpt` | |
| `meta_description` | `meta_description` | for the consumer's `<head>` |
| `tags` | `tags` | string[] |
| `hero_image` | `hero_image_url` | Supabase CDN URL, loads anywhere |
| `hero_image_alt` | `hero_image_alt` | |
| `hero_image_credit` | `hero_image_credit` | |
| `author` | `created_by` | defaults "Clem" |
| `published_at` | `published_at` | ISO-8601 |
| `updated_at` | `updated_at` | ISO-8601 — drives `since` |
| `url` | derived | canonical `https://{domain}/blog/{slug}` |
| `deleted` | derived | `true` only in tombstones |

### Post (single) — PostSummary plus:

| field | source | notes |
|---|---|---|
| `body_html` | `toHtml(body_mdx)` | server-rendered; see caching note |
| `body_format` | const | `"html"` — reserved for future raw-MDX option |

### Tombstone

```json
{ "id": "…uuid…", "slug": "old-slug", "deleted": true, "updated_at": "…" }
```

Returned in `?since=` list responses (and as the `410` body on the single-post
route) so consumers can mirror unpublishes/deletes instead of leaking stale posts.

> Requires distinguishing "unpublished" from "hard-deleted". `blog_posts` already
> has a `rejected` status and a full status enum, but a row that is hard-deleted
> disappears entirely. To emit delete tombstones reliably, add a soft-delete marker
> (`deleted_at timestamptz`) and have the app set it rather than issuing `DELETE`,
> **or** record deletions in `publish_log` and union them into `?since=` responses.
> Recommend `deleted_at` — simplest correct option. (Schema change, see below.)

## Identity & slug strategy

- Add `tenants.public_slug text not null unique`. Backfill from current
  `domainToSlug(domain)` for existing tenants; expose in the tenant settings UI so
  Richard/superadmin can set it explicitly when onboarding Putterfingers,
  Photocutouts, Merchycart.
- Lookups become an exact, indexed match on `public_slug` — no `ilike` scan, no
  collision risk.
- Keep `domainToSlug()` only as the backfill default, not the request-time resolver.

## Caching

- Published content is public and changes infrequently → cache aggressively at the
  edge: `Cache-Control: public, s-maxage=300, stale-while-revalidate=86400`.
- Emit a strong `ETag` (hash of the serialized payload) and honour
  `If-None-Match` → `304`. Critical for the WordPress/cron poller, which will hit
  `?since=` on a schedule and should mostly get cheap 304s.
- `?since=` responses with a cursor should be `private`/short-TTL (they're
  consumer-specific); the unparameterised list and `/theme` are the hot, shared,
  long-TTL paths.
- Precompute `body_html` on publish (store rendered HTML alongside `body_mdx`)
  rather than running `toHtml` per request. Optional v1.1, but it removes the only
  CPU-heavy step from the single-post path.

## Auth, CORS, rate limiting

- Reads stay public (the content is published anyway) with wildcard CORS — the
  embed must work from any origin.
- Add per-tenant **rate limiting** keyed on `public_slug` + IP (e.g. token bucket
  at the edge / Upstash). Protects Supabase from scraping and runaway embeds.
- Optional **read API key** per tenant (`tenants.content_api_key`) for higher-trust
  consumers (the WP plugin) that want higher rate limits or, later, access to
  draft/preview content. Passed as `Authorization: Bearer …`. Not required for the
  public published feed.
- Never expose the service role key client-side; all of this runs server-side in the
  route handlers (as v0 already does).

## Versioning

- Prefix everything `/v1/`. Additive changes (new fields) ship without a bump;
  removals/renames require `/v2/`.
- Keep `/api/feed/...` as a permanent alias of v1 list/single so nothing already
  wired up breaks.

## Required schema changes (run as Supabase migrations)

1. `alter table tenants add column public_slug text;` + unique index + backfill +
   `not null` once backfilled.
2. `alter table blog_posts add column deleted_at timestamptz;` and route deletes
   through a soft-delete update. (Or the `publish_log` union alternative above.)
3. *(optional, v1.1)* `alter table blog_posts add column body_html text;` populated
   on publish.

Migrations are numbered files in `supabase/migrations/` and Richard runs them
manually in the Supabase dashboard — these would be `025_…`, `026_…`.

## Build order within this spec

1. Add `public_slug` + migration + exact-match resolver. (Unblocks clean identity.)
2. Add `id` + `updated_at` to existing feed payloads. (Backwards-compatible.)
3. Add `?since=` + pagination + tombstones (needs `deleted_at`).
4. Add caching headers + ETag/304.
5. Add `/theme` endpoint + `include=theme`.
6. Add rate limiting (+ optional API key).
7. Rename to `/api/content/v1`, alias `/api/feed`.

Steps 1–2 are a day's work and immediately unblock the JS embed for your four owned
sites. Steps 3–4 are what the WordPress plugin actually needs to sync correctly.

## Open questions

- Do you want draft/preview access (token-gated) in v1, or strictly published-only?
- Single shared public hostname (`api.nobrandleftbehind.com`) vs serving straight
  from the app domain — affects CORS/CDN setup but not the handlers.
- Hard cap on `limit`/total posts per tenant for the unbounded list, or rely on
  pagination from day one?
