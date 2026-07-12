# Bailey — image gallery agent (build spec)

Bailey is a new NBLB agent (roster: Clem = blog, Scout = SEO/research, Bailey =
images/galleries). Scope is deliberately **SEO-only** — no merch/ordering funnel.
Built as a generic tool for our own sites first, then productised for clients.

**Core value / the pain it solves:** staff have good event/product photos sitting
on laptops that never make it online. Bailey gives them a **zero-effort image
bucket** to dump into; Bailey then optimises, captions, and publishes a proper
gallery page. The upload IS the product — not a bring-your-own-URL step.

---

## Principles

- **Upload-first.** Drag-drop dump → Bailey takes over. No URL hunting.
- **Reuse what exists.** A gallery is another content type in the same
  `blog_posts` model, published through the same native path we built (Shopify
  article/page `body_html`, or Astro prerender). No new publishing pipeline.
- **Enrichment is the differentiator**, not the lightbox: AI alt text + captions,
  `ImageObject` schema, and a Clem hand-off for page copy so the page isn't thin.
- **Native/server-rendered, never the JS embed** (the embed doesn't deliver SEO).

## Storage — Supabase Storage (not Shopify Files)

NBLB already runs on Supabase, which includes Storage (S3-style, CDN URLs). Use a
single per-tenant-scoped bucket for every tenant:

- Bucket `gallery-images`, objects at `{tenantId}/{galleryId}/{filename}`.
- Public read; writes via **signed upload URLs** (browser → Storage directly),
  because Vercel serverless has a ~4.5MB request-body limit — do NOT proxy large
  images through a route.
- The public Supabase CDN URLs are what get referenced in the published Shopify
  `body_html` / Astro HTML. Cross-CDN images are fine for SEO — only the IndexNow
  key file ever needed host-matching, not images.

## Data model

- `blog_posts.content_type = 'gallery'` (reuses the existing content-type column).
- New `blog_posts.gallery_images jsonb` — ordered array:
  `[{ storage_path, url, thumb_url, width, height, alt, caption, order }]`.
- A gallery IS the page (no separate pool/many-to-many like FAQ topics needed).

## Pipeline

1. **Ingest** — dropzone multi-upload → signed URL → Supabase Storage. Records
   each object against the gallery.
2. **Process (sharp — already a dependency)** — per image: **auto-orient** (EXIF
   rotation), resize/compress to a web master + thumbnail + 1–2 responsive sizes,
   strip bulky metadata, write variants back to Storage. Process **per-image**
   (not all at once) to stay inside function time/memory limits.
3. **Enrich (Claude vision — SDK already in NBLB)** — per image: concise
   descriptive **alt text** + a one-line **caption** (and optionally a suggested
   descriptive filename). Stored on the image object. Cheap.
4. **Copy hand-off (Clem)** — given the gallery title + captions, Clem writes an
   intro paragraph (and optional short section copy) so the page has crawlable
   substance. Mirrors `lib/clem/faq.ts` generation.
5. **Render + publish** — build the page body: Clem intro + a responsive image
   grid (`<img srcset loading="lazy" alt>`) + one `ImageObject` JSON-LD per image.
   Store as the gallery's body; publish via the existing adapter with a small
   `content_type === 'gallery'` branch (use the built gallery HTML rather than
   `toHtml(body_mdx)`). Lightbox is progressive enhancement only (see spike).

## Review gate (UX)

Zero-effort in, light-touch review before publish:
`Create gallery → drop images → Bailey auto-processes + captions (progress shown)
→ user edits alt/captions, reorders, removes → Generate page copy → preview →
publish` (into the normal review/publish flow). No auto-publishing unreviewed AI
captions onto live pages.

## Two spikes before building

1. **Lightbox on Shopify:** does a lightbox `<script>` survive in article
   `body_html`? If not, v1 ships a responsive grid with linked full-size images
   (no JS lightbox) — the SEO value is entirely in the server HTML + schema + copy.
2. **sharp on Vercel at scale:** confirm large-image processing stays inside
   function limits; if not, cap input size and/or process one image per request.

## Phasing

**Phase 1 (MVP, Shopify tenants first):** Storage bucket + signed-URL dropzone +
sharp processing + vision alt/captions + gallery render (grid + `ImageObject`) +
Clem intro copy + publish via adapter + Bailey review UI. Decide the target
surface (a dedicated `/blogs/galleries` blog, vs Pages).

**Phase 2:** lightbox (post-spike), Astro/Content-API rendering, descriptive
filename renaming, bulk edit/reorder niceties, storage quota as a billing tier
(for clients), EXIF/geo (only if local-SEO relevant), image sitemap (only if the
platform's auto-sitemap doesn't already cover it — Shopify/Astro usually do).

## Effort

A real feature — roughly the FAQ Topics build **plus** an upload/processing
layer, but tractable via Supabase Storage (not the scary Shopify-Files route).
Sub-stages, verified as we go: (1) schema + Storage bucket + signed-URL upload;
(2) sharp processing; (3) vision enrichment; (4) render + `ImageObject` + adapter
branch; (5) Clem copy; (6) Bailey UI + review gate. Multi-session.

## Open decisions

- Target surface for galleries: dedicated Shopify blog vs Pages (likely a
  dedicated `galleries` blog, mirroring FAQs).
- Storage bucket policy (public-read; controlled write) + naming.
- Max upload size / count per gallery (protects processing + storage).
- Whether descriptive auto-renaming is worth it in v1 (marginal SEO, nice-to-have).

## Prioritisation

Net-new agent competing with the current backlog (Photocutouts setup, WP-blog
migration, GA4-into-dashboard). Legitimate roster addition — sequence
deliberately; the FAQ Topics feature still wants a proper live shake-down first.
