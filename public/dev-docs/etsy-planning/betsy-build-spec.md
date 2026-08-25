# Betsy — Etsy Shop Agent (Build Spec v1)

Betsy manages an Etsy shop from the NBLB dashboard: product records, AI-written
listing copy, product imagery, and sync into Etsy as **draft** listings, plus
ongoing inventory management. Betsy never activates a listing and never
publishes unreviewed output.

**Betsy is not an NBLB agent.** Clem (writing), Scout (research), Bailey
(galleries) and Pam (planning) are all tenant-scoped and all resolve to
`blog_posts`. Betsy is neither — it is a **co-resident app** inside the NBLB
repo, following the `repeatafterme` pattern: own `lib/`, own API routes, own
migrations directory, zero coupling to the tenant model. It borrows NBLB's
*infrastructure and code*, not its data model.

**Stack context:** Next.js 14 App Router on Vercel, Supabase (DB + Storage),
Clerk auth, Anthropic SDK, existing Bailey image pipeline. Match repo
conventions for file layout, route naming and error handling throughout.

---

## Principles (binding)

- **Original only.** No competitor images, no reworded competitor copy, no
  replicated artwork. This was settled early in the project and is **fixed —
  not to be re-litigated** during build.
- **No scraping. Ever.** Etsy's ToS forbids it regardless of technical
  feasibility, and Richard has real revenue tied to Etsy through fulfilment
  clients. Research is manual entry or compliant third-party tools only.
- **Drafts by default.** Betsy creates Etsy listings in `draft` state. A human
  activates. This matches the platform-wide "no auto-publishing unreviewed AI
  output" rule already binding on Bailey and Pam.
- **Betsy owns the product; Etsy owns the listing lifecycle.** Local records
  are the source of truth for content. Etsy is authoritative for listing state,
  stock after sale, and expiry. Never assume the two agree — reconcile.
- **Betsy must never be able to break NBLB.** Isolation rules below are part of
  the spec, not a style preference.
- **Ship narrow.** One shop, drafts only, manual research. Breadth is a v2
  problem.

---

## Isolation contract (binding)

| Rule | Detail |
|---|---|
| Migrations | `supabase-betsy/migrations/`, own numbering from `001`. Never touches NBLB's `supabase/migrations/` sequence (currently at 043). |
| Existing tables | **Zero `ALTER` statements.** Betsy adds tables only. (Note: less intrusive than Bailey, which altered `blog_posts` twice.) |
| Code location | `lib/betsy/`, `app/api/betsy/`, `app/(platform)/betsy/`. |
| Shared code | **Import-only.** If Bailey's image pipeline needs a change to serve Betsy, that is a deliberate extraction to `lib/images/` as separate work — never an in-place edit that silently alters gallery behaviour. |
| Route placement | Top-level `/betsy`, Clerk-protected with an admin check. **Not** under `/dashboard/*` — middleware applies workspace-cookie logic there and Betsy is not workspace-scoped. |
| Scope root | `betsy_shops`. **Not `tenant_id`** — an Etsy shop is not a website tenant, and forcing it into the tenant model is the one change that would genuinely entangle Betsy with NBLB. |
| Feature flag | `BETSY_ENABLED` env gate on nav + routes, so it can be switched off without a code change. |

**Prerequisite (do first, benefits NBLB regardless):** NBLB has no CI — no
`.github/workflows`, and `package.json` has only `dev`/`build`/`start`/`lint`.
The only gate on a deploy is `next build` on Vercel. Add a `typecheck` script
and a minimal Actions workflow before Betsy lands, so a Betsy type error is
caught in CI rather than blocking an NBLB deploy. (A failed build does not take
NBLB down — Vercel keeps the last good deployment serving — but it does block
shipping until fixed.)

---

## Decisions locked

| Decision | Resolution |
|---|---|
| Multi-tenancy | Internal tool, one shop. No per-tenant OAuth. |
| Etsy auth | One-time **manual** OAuth handshake to mint a refresh token; store it; refresh programmatically thereafter. (Etsy v3 has no machine-to-machine grant — see Spike 2.) |
| Credential storage | v1 env vars. Nullable token columns exist on `betsy_shops` as the documented upgrade path if a second shop appears. Do not build that path now. |
| Listing state on sync | Always `draft`. Human activates in Etsy or via an explicit Betsy action. |
| IP safety mechanism | `source_type` on every product. `design_led` forces manual review before sync becomes available. |
| Filler images | `is_filler` per image. **Any** filler image on a product hard-blocks sync. Mirrors Bailey's consent-attestation publish gate. |
| Research method | Manual entry only. Structured form, category-level facts only. |
| Image pipeline | Reuse Bailey's (sharp → Supabase Storage → signed upload URLs → vision alt/caption). |
| Copy generation | Reuse `lib/anthropic.ts` and Clem's generation-module conventions. |
| Channel abstraction | None. Etsy-specific tables. A `channel` column can be added later if Merchycart/Shopify products ever need this — do not pre-abstract. |

---

## Open question — genuinely blocking

**DIYPaperPrints: fulfilment client, or competitor being studied?** Unresolved
in the briefing. It determines whether their listing data can be used freely
(client — no IP issue) or research-only (competitor — facts only, no copying).
Resolve before any research records are captured against them.

**Resolved by design, not blocking:** the briefing flags "item-type-only vs
artwork-too" as needing a steer. It doesn't. Encoding both paths in
`source_type` (format-derived → sync-eligible after normal review; design-led →
forced manual review) means the decision becomes a per-product judgement rather
than an upfront architectural one.

---

## Spikes (run BEFORE building — each has a defined fallback)

These are Etsy API specifics that must be **verified against current docs**
rather than assumed. API details drift and the figures below are indicative.

1. **App registration + scopes.** Confirm the scopes needed
   (`listings_r/w/d`, `shops_r/w`, `transactions_r` or current equivalents) and
   the approval turnaround for a self-shop app.
   - *Fallback:* if approval is slow, build against the sandbox/draft flow and
     defer sync until granted — steps 1–3 of the build order don't need it.
2. **OAuth flow reality.** Etsy v3 uses authorization-code + PKCE; there is no
   client-credentials grant like the Shopify path in NBLB. Verify that a
   one-time manual handshake yields a refresh token usable indefinitely via
   rotation, and confirm access/refresh token lifetimes (believed ~1h / ~90d).
   - *Fallback:* if refresh tokens expire hard, add a re-authorise prompt in
     the UI plus an alert when refresh fails.
3. **Rate limits.** Confirm current limits (believed ~10k/day, ~10/sec) and
   implement a conservative throttle. New shops with sudden bulk listing
   activity can trigger review flags — throttle well under the ceiling.
4. **Listing creation sequence.** Verify: create draft listing →
   upload images (separate endpoint) → `updateListingInventory` for
   variations/stock. Confirm whether price lives on the listing or moves to
   inventory offerings once variations exist.
5. **Shipping profiles.** A listing cannot be created without a valid shipping
   profile existing in the shop. Confirm and capture the profile id(s) before
   first sync.
6. **Listing fees.** Activating a listing costs a per-listing fee with a
   ~4-month expiry/renewal cycle. Confirm current cost and make sure the UI
   never lets a bulk action silently spend money. This is a real reason drafts
   are the default.
7. **Image constraints.** Confirm max images per listing (believed 10), file
   size and dimension limits, and whether Bailey's web master (2000px long
   edge, q82) meets Etsy's recommended resolution — Etsy favours large images.

---

## Data model (`supabase-betsy/migrations/001_betsy_core.sql`)

```sql
-- Scope root. One row in v1; the table exists so multi-shop is a data change,
-- not a schema migration. Token columns are the documented upgrade path from
-- env-var credentials — unused in v1.
create table betsy_shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  etsy_shop_id text unique,
  etsy_shop_name text,
  currency text not null default 'GBP',
  default_shipping_profile_id bigint,
  is_active boolean not null default true,
  etsy_refresh_token text,          -- v1: null, credentials live in env
  etsy_access_token text,
  etsy_token_expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- The local product record: source of truth for OUR content.
create table betsy_products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references betsy_shops(id) on delete cascade,

  -- Listing content (generated or hand-written, always original)
  title text not null,
  description text,
  tags text[] default '{}',         -- Etsy caps at 13
  materials text[] default '{}',    -- Etsy caps at 13
  taxonomy_id integer,              -- resolved via Etsy taxonomy API

  -- Commercial
  price numeric(10,2),
  currency text not null default 'GBP',
  quantity integer not null default 0,
  sku text,

  -- Etsy-required attributes
  who_made text check (who_made in ('i_did','someone_else','collective')),
  when_made text,                   -- Etsy enum, e.g. 'made_to_order'
  is_supply boolean default false,

  -- Physical (needed for shipping calculation)
  weight_grams integer,
  length_mm integer, width_mm integer, height_mm integer,
  shipping_profile_id bigint,

  -- IP provenance. THE safety field.
  --   format_derived = "totes sell well, we make totes"     -> normal review
  --   design_led     = derived from a specific design idea  -> manual review
  --   original       = our own design from scratch          -> normal review
  source_type text not null default 'format_derived'
    check (source_type in ('format_derived','design_led','original')),
  source_note text,                 -- what informed it; audit trail

  review_state text not null default 'draft'
    check (review_state in ('draft','needs_review','approved','blocked')),
  reviewed_by text, reviewed_at timestamptz,

  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index on betsy_products (shop_id, review_state);

comment on column betsy_products.source_type is
  'IP provenance. design_led always routes to manual review before sync.';

-- Product imagery. Filler images keep a record structurally complete before
-- real photography/mockups exist — and hard-block sync while present.
create table betsy_product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references betsy_products(id) on delete cascade,
  storage_path text not null,
  url text, thumb_url text,
  width integer, height integer,
  alt text, caption text,
  rank integer not null default 0,
  source text not null default 'filler'
    check (source in ('filler','ai_mockup','photo')),
  is_filler boolean not null default true,
  etsy_listing_image_id bigint,
  created_at timestamptz default now()
);

create index on betsy_product_images (product_id, rank);

comment on column betsy_product_images.is_filler is
  'Placeholder imagery. Any filler image on a product blocks Etsy sync.';

-- The Etsy-side mirror. Separate from the product because Etsy owns this
-- lifecycle (state, expiry, stock after sale) and the two WILL drift.
create table betsy_listings (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references betsy_products(id) on delete cascade,
  shop_id uuid not null references betsy_shops(id) on delete cascade,
  etsy_listing_id bigint unique,
  state text,                       -- draft|active|inactive|expired|sold_out
  url text,
  etsy_quantity integer,            -- as Etsy last reported it
  last_synced_at timestamptz,
  sync_error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Market research. CATEGORY-LEVEL FACTS ONLY — item type, dimensions,
-- materials, price point, audience, popularity signals. Never competitor
-- copy or images. Manual entry or compliant tool export only; no scraping.
create table betsy_research (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references betsy_shops(id) on delete cascade,
  item_type text not null,
  source text not null default 'manual'
    check (source in ('manual','erank','alura','marmalead')),
  competitor_ref text,              -- shop/listing reference, for provenance
  relationship text                 -- resolves the client-vs-competitor question
    check (relationship in ('competitor','fulfilment_client','unknown')),
  price_point numeric(10,2),
  sales_signal integer, favourites integer, reviews integer,
  dimensions text, materials text,
  audience text, occasion text,
  notes text,
  verdict text default 'watch' check (verdict in ('pursue','watch','reject')),
  linked_product_id uuid references betsy_products(id) on delete set null,
  captured_by text,
  captured_at timestamptz default now()
);

-- Mirrors NBLB's publish_log convention.
create table betsy_sync_log (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references betsy_shops(id) on delete cascade,
  product_id uuid references betsy_products(id) on delete set null,
  action text not null,             -- listing_created|images_uploaded|
                                    -- inventory_updated|state_pulled|...
  success boolean not null,
  response_data jsonb,
  error_message text,
  attempted_at timestamptz default now()
);
```

RLS: Betsy routes run service-role behind an admin check, consistent with how
NBLB handles admin surfaces. Enable RLS with no public policies.

---

## The sync gate (single enforcement point)

One function, called by every sync path. A product may sync only when **all**
hold:

1. `review_state = 'approved'`
2. No image on the product has `is_filler = true`
3. At least one image exists
4. `source_type != 'design_led'` **or** a human has explicitly approved it
   (recorded in `reviewed_by`/`reviewed_at`)
5. Required Etsy fields present: `taxonomy_id`, `price`, `quantity`,
   `who_made`, `when_made`, `is_supply`, `shipping_profile_id`

Gate failures are surfaced as a checklist in the UI, never as a silent no-op.

---

## Sync mechanics

- **Create:** draft listing → upload images in `rank` order →
  `updateListingInventory` for stock/variations → store `etsy_listing_id`,
  `state`, `url` on `betsy_listings` → log.
- **Update:** diff local product against last-known Etsy state; push only
  changed fields. Never blind-overwrite.
- **Pull:** scheduled reconcile of listing `state` and `etsy_quantity` so the
  dashboard reflects sales/expiry. Etsy wins on stock; Betsy wins on content.
- **Throttle:** conservative fixed-rate queue well under the documented ceiling,
  with backoff on 429. Bulk operations are chunked and resumable.
- **Every call logged** to `betsy_sync_log`, success or failure. Failures never
  throw into the UI as a stack trace.

---

## UI — `/betsy`

- **Products** — table (title, price, stock, review state, sync state, image
  count with a filler badge). Filter by review/sync state. Bulk select for
  chunked sync.
- **Product editor** — spec fields, image manager (drag-drop, reuse Bailey's
  uploader), "Generate copy" action (title/description/tags from spec via
  Anthropic), taxonomy picker, `source_type` selector with plain-English help,
  and the **sync gate checklist** showing exactly what's blocking.
- **Research** — capture form (category-level facts only, with the constraint
  stated in the UI), list with verdict filter, "promote to product" action that
  pre-fills a product from a `pursue` record.
- **Shop** — connection status, token health, last sync, recent
  `betsy_sync_log` entries.
- Nav: Betsy section, admin-only, hidden unless `BETSY_ENABLED`.

---

## Build order

1. **CI prerequisite** — `typecheck` script + minimal Actions workflow on NBLB.
   **← do first**
2. Migration `001` + `betsy_shops` row + one-time OAuth handshake + token
   refresh helper + shop connection page. **← buildable now (pending Spikes 1–2)**
3. Product CRUD + image upload (Bailey pipeline) + filler flagging + sync gate
   (enforced but not yet wired to Etsy).
4. AI listing generation (title/description/tags) + Etsy taxonomy lookup.
5. Etsy sync: create draft → images → inventory → store listing record. Throttled.
6. Reconcile pull (listing state + stock) + update-diff push + scheduled cron.
7. Research capture + promote-to-product.

---

## Non-goals (v1)

No auto-activation of listings (drafts only, human activates). No orders or
fulfilment sync. No multi-shop. No per-tenant OAuth. No scraping, ever. No
competitor artwork replication. No channel abstraction (Shopify/eBay/Amazon).
No auto-renewal management. No variations beyond what `updateListingInventory`
needs for a simple single-offering product — multi-variation products are a
deliberate v2.
