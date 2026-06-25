# NBLB Feature Roadmap — FAQ, Analytics, Content-Refresh

Build spec for the next three capabilities, in priority order. Goal: drive more
organic traffic to our own sites, with each feature reusing the existing
Clem/Scout infrastructure as far as possible.

Priority: **1. FAQ content type → 2. Visitor analytics & page-performance → 3. Content-refresh agent.**

---

## Shared foundation (do this first — small, unblocks Features 1 & 3)

Today `blog_posts` only ever holds blog articles. FAQ and refresh both need the
system to distinguish content types and to record why a post exists.

**Migration `030_content_types.sql`**

```sql
-- A post is a blog article by default; FAQ is the new type.
alter table blog_posts add column content_type text not null default 'blog'
  check (content_type in ('blog', 'faq'));

-- Structured Q&A for FAQ posts (drives FAQPage schema). Null for blog posts.
alter table blog_posts add column faq_items jsonb;        -- [{ "q": "...", "a": "..." }]

-- Why this post exists / when it was last materially refreshed.
alter table blog_posts add column origin text default 'manual';  -- 'clem' | 'scout' | 'refresh' | 'manual'
alter table blog_posts add column last_refreshed_at timestamptz;

-- Suggestions also need to know what they'll become.
alter table suggestions add column content_type text not null default 'blog'
  check (content_type in ('blog', 'faq'));
```

Update `lib/supabase/types.ts` accordingly (regenerate or hand-edit). No
behaviour change for existing posts — everything defaults to `blog`.

---

## Feature 1 (build first): FAQ content type

### Goal
Let Clem generate and maintain FAQ pages built from (a) real customer questions
we add manually and (b) Scout's PAA mining (`scout_keyword_opportunities` where
`opportunity_type = 'paa'`, currently produced but barely used). The Q&A content
targets long-tail and question queries, and is strong for regular featured
snippets, People-Also-Ask, and AI-Overview/LLM citations — high-ROI for the least
new code.

> **Note on FAQ rich results (important — changed since first draft).** Google has
> deprecated the FAQ *rich result* (the expandable Q&A snippet): restricted to
> government/health sites in Aug 2023, stopped showing entirely on 7 May 2026, and
> FAQ support is being removed from the Rich Results Test / Search Console in
> June–Aug 2026. So a FAQ page will **not** get the FAQ accordion in Google, and
> the Rich Results Test will report only the Article (BlogPosting) schema — that is
> expected, not a bug. We still emit `FAQPage` JSON-LD because (a) Google says it
> continues to *use* the data to understand pages, and (b) other engines (Bing) and
> AI answer engines still consume it. The traffic case rests on the **content**
> (snippets, PAA, AI answers), not the rich result.

### Data sources
- `scout_keyword_opportunities` rows with `opportunity_type IN ('paa','gap')` — already populated by Scout Pipeline 3.
- A new manual question store so we can feed in questions we actually get asked:

```sql
-- Migration 031_faq_questions.sql
create table faq_questions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  question text not null,
  source text default 'manual',          -- 'manual' | 'scout_paa' | 'support'
  topic text,                            -- optional grouping for which FAQ page
  status text default 'open',            -- 'open' | 'used' | 'dismissed'
  used_in_post_id uuid references blog_posts(id),
  created_at timestamptz default now()
);
```

### Backend
New module `lib/clem/faq.ts`, mirroring `lib/clem/draft.ts`:

- `runFaqDraft(tenantId, opts)` where `opts` is either `{ suggestionId }` or
  `{ topic, questionIds[] }`. Steps:
  1. Load tenant (brand voice, audience, forbidden words, `internal_links`) —
     same as `runDraft`.
  2. Gather questions: pull selected `faq_questions` + relevant
     `scout_keyword_opportunities` PAA rows for the topic.
  3. One Claude call (use shared `@/lib/anthropic` client) returning **JSON**, not MDX:
     ```json
     {
       "title": "...", "slug": "...", "metaDescription": "...",
       "intro": "1-2 sentence intro (optional)",
       "tags": ["..."],
       "faq_items": [{ "q": "...", "a": "answer in markdown, 40-120 words, with 1-2 internal links where natural" }]
     }
     ```
     System prompt reuses the draft.ts voice/audience/forbidden-words and the
     internal-linking block verbatim. Answers must be self-contained (snippet-friendly)
     and factual — no invented specifics.
  4. Render `body_mdx` from the JSON (intro + `## {q}` / answer per item) so the
     existing `toHtml` pipeline and all consumers render it with zero changes.
  5. Insert into `blog_posts` with `content_type='faq'`, `faq_items` (the jsonb),
     `origin='clem'`, `status='draft'` — same review/schedule/publish lifecycle as blogs.
  6. Mark used `faq_questions.status='used'` and link `used_in_post_id`.

API route `POST /api/clem/faq` (clone `app/api/clem/draft/route.ts`, including the
`aiErrorResponse` overload handling we just added).

### Rendering & schema
Emit `FAQPage` JSON-LD from `faq_items` on every delivery surface. (This no longer
produces a Google FAQ rich result — see the deprecation note above — but Google
still uses it to understand the page, and Bing/AI engines consume it, so it's worth
shipping. The visible, well-structured Q&A is what actually earns the traffic.)

- **Content API** (`lib/content/api.ts`): in `toPost`, when `content_type==='faq'`,
  include `faq_items` and a ready-made `faq_jsonld` string in the response so
  Astro/embed consumers can drop it straight into `<head>`.
- **Hosted blog** (`app/blog/[slug]/page.tsx`): render a `<script type="application/ld+json">`
  with the `FAQPage` schema, plus accessible `<details>`/`<summary>` or H2+answer markup.
- **Embed** (`public/blog.js`): render Q&A list; inject the JSON-LD into the host `<head>`.

Add `content_type` to `SUMMARY_COLUMNS`/`POST_COLUMNS` so listings can badge FAQ
pages. Listing/tags/feed endpoints need no other change.

### UI
- A "Questions" tab (new) to add/triage `faq_questions` and pull Scout PAA into them.
- "Generate FAQ page" action on a topic/selection → calls `/api/clem/faq`.
- FAQ posts appear in the existing review queue and editor (Tiptap already handles
  the markdown body; `faq_items` is the source of truth for schema).

### Automation
Extend the Scout→Clem handoff (`lib/scout/clem-handoff.ts`) so clustered PAA
questions can auto-create an FAQ **suggestion** (`content_type='faq'`), and let a
scheduled job periodically refresh/extend an existing FAQ page as new questions
accumulate (ties into Feature 3).

### Effort / risk
Low–Medium. ~90% reuse (lifecycle, Content API, rendering, scheduling, review).
New: one module, one route, schema markup, one UI tab. Low risk.

### Acceptance criteria
- Can generate an FAQ page from selected questions; it flows through review → publish.
- Published FAQ page renders the Q&A and carries valid `FAQPage` JSON-LD (verify with
  the Schema Markup Validator at validator.schema.org — note Google's Rich Results
  Test no longer reports FAQ, by design; see the deprecation note above).
- PAA questions from Scout are selectable as FAQ inputs.

---

## Feature 2: Visitor analytics & page-performance map

### Goal
Close the loop: measure entry/exit/underperforming pages per site, diagnose
*why*, and feed fixes back to Clem (and to Feature 3). This is the strategic
backbone — it tells us whether FAQ/blog/refresh work.

### Decision (locked): start with Path A (provider)
We will integrate a privacy-first analytics provider (Path A) and put the build
effort into the AI analysis layer, which is built provider-agnostic so Path B
(first-party) can be swapped in later without rework. Path B remains specced
below for reference only.

### Approach
Do **not** build a raw high-volume pageview pipeline from scratch (bot filtering,
sessionisation, scale, and UK/GDPR consent are each a project). Two viable paths —
pick based on how much you want to own the data:

- **Path A (faster): integrate a privacy-first provider** (Plausible / Umami —
  both cookieless, no consent banner needed) and pull stats via their API on a
  schedule. Least build; good enough to start optimising immediately.
- **Path B (full ownership): lean first-party collector** (spec below). More work,
  but the event data also becomes a Scout signal and a productisable asset.

**Either way, the differentiated value is the AI analysis layer, not the
collection.** Build that layer provider-agnostic so you can start on Path A and
swap in Path B later.

### Path B — first-party collector (if/when you want ownership)
- `public/nblb-analytics.js` — tiny script (served like `blog.js`, `data-tenant`
  attribute), sends a beacon on pageview + on `visibilitychange`/unload for dwell time.
  Cookieless: derive an anonymous daily visitor hash from `salt + ip + ua` (salt
  rotates daily, no PII stored) so no consent banner is required.
- `POST /api/analytics/collect` — edge route, validates tenant, drops bots
  (UA list + missing-JS heuristics), writes raw rows.

```sql
-- Migration 032_analytics.sql
create table analytics_events (
  id bigint generated always as identity primary key,
  tenant_id uuid references tenants(id) on delete cascade not null,
  visitor_hash text,          -- anonymous, rotates daily
  session_id text,
  path text not null,
  referrer text,
  is_entry boolean default false,
  is_exit boolean default false,
  dwell_ms integer,
  device text,
  created_at timestamptz default now()
);
create index on analytics_events (tenant_id, created_at);

-- Nightly rollup the dashboard/AI reads (keeps raw table out of hot paths).
create table analytics_page_daily (
  tenant_id uuid references tenants(id) on delete cascade not null,
  day date not null,
  path text not null,
  pageviews integer default 0,
  entries integer default 0,
  exits integer default 0,
  avg_dwell_ms integer,
  bounces integer default 0,
  primary key (tenant_id, day, path)
);
```

- Nightly cron `/api/analytics/rollup` aggregates `analytics_events` →
  `analytics_page_daily`, then prunes raw events older than N days.

### AI analysis layer (the core — build regardless of path)
`lib/analytics/insights.ts`:
- `classifyPages(tenantId)` — pull rollups (or provider API), compute per-page
  metrics, and label pages **good / average / underperforming** using relative
  thresholds (high exit + low dwell + traffic = underperforming; high entry +
  good dwell = strong landing page; etc.).
- `synthesisePageReport(tenantId)` — reuse the **Scout briefing pattern**
  (`lib/scout/briefing.ts`): feed the classified data to Claude for plain-English
  diagnosis + recommended fixes, with the same deterministic-fallback safety net.
- Join to existing signals for attribution: `scout_rank_history` (did rank move?)
  and `blog_posts.published_at` (did our content cause the change?).

### Output & loop-closing
- New dashboard page `dashboard/analytics` — page-performance table + AI report
  (urgent/watch/win, same component style as Scout briefings). Consider a live
  artifact for the at-a-glance version.
- Actionable handoffs: "underperforming blog post" → one click to the
  **content-refresh agent** (Feature 3); "missing topic with traffic" → Clem
  suggestion; "high-exit product page" → flag for manual CRO.

### Effort / risk
Medium (Path A) to High (Path B). Risk mostly in collection (scale/consent) —
mitigated by starting on Path A. The AI layer is moderate and reuses Scout patterns.

### Acceptance criteria
- Per-site page-performance report with good/underperforming classification.
- AI diagnosis + recommendations rendered in dashboard.
- At least one automated handoff into Clem/refresh.

---

## Feature 3 (new): Content-refresh agent

### Goal
Detect decaying/stale published content and have Clem refresh it. Refreshing
existing pages is one of the highest-ROI SEO actions and reuses almost everything
already built. Scout already detects the key signal (rank drops).

### Decay signals (combine into a score)
- **Google Search Console decay (primary trigger).** Per-URL drops in impressions
  and average position from the GSC Search Analytics API are the sharpest, free
  signal of a page losing ground — refresh what's *slipping*, not what's merely
  old. Make this the main trigger. (We already have the GSC API integration muscle
  from Arena Sync.) Requires connecting each tenant's GSC property.
- **Rank decline** — `scout_rank_history` (`position_change` negative,
  `droppedFromTop10`); already captured by Scout's own-site pipeline (good fallback
  before GSC is connected).
- **Traffic decline** — `analytics_page_daily` trend (once Feature 2 ships).
- **Age** — `published_at` / `last_refreshed_at` older than a per-tenant threshold.
- **AI-Overview loss** — Scout already counts AI-Overview keywords; flag pages that lost presence.

### Backend
`lib/clem/refresh.ts`:
- `findStaleContent(tenantId)` → returns scored candidates (published `blog_posts`,
  any `content_type`) ranked by decay score.
- `runRefresh(postId)`:
  1. Load the post's current `body_mdx` + the keyword(s) it targets.
  2. Pull fresh context: current SERP/PAA for those keywords (Scout/DataForSEO),
     and the tenant's current `internal_links`.
  3. One Claude call (shared client) to **revise** — update stats/dates, add/expand
     sections to match current intent, improve internal links, tighten — while
     preserving slug, URL, and what already works. Return updated MDX (+ updated
     `faq_items` if it's an FAQ).
  4. Save a version before overwriting (see below), update `body_mdx`,
     `last_refreshed_at`, `origin='refresh'`, and set status back to `in_review`.
     **Decision (locked): refreshes default to human review** (`in_review`).
     Direct auto-publish is an explicit per-tenant opt-in only (e.g.
     `scout_config.auto_refresh_publish`), off by default.
     **Atomic freshness update (important):** the real content change, the
     `dateModified`/`last_refreshed_at` bump, and the JSON-LD `dateModified` must
     all happen together as one operation. Never bump the modified date without a
     substantive edit — Google devalues (and can penalise) date-spoofing. No real
     change → no date bump.
  5. On publish, the existing `triggerDeployHook` + content-cache purge (already
     built) make the change live — static consumers rebuild, Content API serves
     the new body on next request.

### Versioning / safety
```sql
-- Migration 033_content_versions.sql
create table blog_post_versions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references blog_posts(id) on delete cascade not null,
  body_mdx text,
  faq_items jsonb,
  reason text,                 -- 'refresh' | 'manual_edit'
  created_at timestamptz default now()
);
```
For git-based tenants, a refresh should open a **PR** (the `runPublish` git path
already exists) rather than a direct overwrite — preserving the existing
review-by-PR workflow and giving a rollback.

### Duplicate-intent detection (companion to refresh)
As Clem keeps producing, near-identical-intent pages start competing with each
other in the index (we already have two on Megacheques: "Giant Cheques: Your
Questions Answered" `content_type='blog'` and "Giant Novelty Cheques FAQ"
`content_type='faq'`). The refresh agent (or a companion audit) should detect
overlapping-intent pairs — by tag/keyword overlap and embedding similarity of
title+excerpt — and flag them to **consolidate or deliberately differentiate**.
On consolidation, keep the stronger page and **301-redirect the loser to the
winner** (same redirect discipline as the Megacards migration; for static
consumers this is a redirect-map entry). Never leave two live URLs fighting over
one intent.

### Automation
- Weekly cron `/api/clem/refresh` (mirror `app/api/cron/publish` — `CRON_SECRET`,
  Vercel cron entry in `vercel.json`), opt-in per tenant + a cap, exactly like
  Scout's `auto_run_enabled` / `SCOUT_MAX_TENANTS_PER_RUN` cost controls.
- Surface candidates in the dashboard with a "Refresh now" action; default to
  human review before publish.

### Effort / risk
Medium. High reuse (draft pipeline, status workflow, deploy hook, cache purge,
git PR path). Main new work: decay scoring + the revision prompt + versioning.
Risk: over-rewriting good content — mitigate with versioning, human-review default,
and a prompt that preserves what ranks.

### Acceptance criteria
- Stale-content list ranked by decay score (rank + age at minimum).
- One-click refresh produces a reviewable revision with a saved prior version.
- Opt-in weekly auto-run respects per-tenant cap and review settings.

---

## Sequencing & migrations summary

1. **Shared foundation** — `030_content_types.sql`.
2. **FAQ** — `031_faq_questions.sql` + `lib/clem/faq.ts` + `/api/clem/faq` + schema/rendering + Questions UI.
3. **Analytics** — Path A (provider API, locked) + `lib/analytics/insights.ts` + dashboard; `032_analytics.sql` is Path B only, deferred.
4. **Content-refresh** — `033_content_versions.sql` + `lib/clem/refresh.ts` + weekly cron + dashboard; refreshes default to human review (auto-publish is per-tenant opt-in).

### Cross-cutting reuse to lean on
- Generation: shared `@/lib/anthropic` client (retries) + `aiErrorResponse` for friendly overload handling.
- Lifecycle: `blog_posts` status workflow + review queue + scheduling for all content types.
- Delivery: Content API v1 + embed + hosted blog + the deploy-hook/cache-purge path (no per-site changes needed for new content types beyond rendering).
- Intelligence: Scout PAA/rank/SERP pipelines feed FAQ inputs and refresh signals.
- Synthesis: the Scout briefing pattern (with deterministic fallback) is the template for the analytics report.
