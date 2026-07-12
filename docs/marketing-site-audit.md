# nobrandleftbehind.com — marketing site audit

Audited 2026-07-06. The marketing site is the `app/(marketing)` route group inside
the NBLB app. Today it is: a single-page landing (`/`) + an Academy page
(`/academy`), with a shared nav/footer. Metadata is clean; the site is well-built
but thin, a version or two behind the product, and — awkwardly for an SEO company
— it doesn't practise what it sells.

---

## 1. Positioning & messaging

- **The roster undersells you.** The homepage shows two agents — Clem (live) and Hank (coming soon). But **Scout is live** and only appears buried in the feature grid, and nothing reflects the pipeline (Bailey, Pam, Evie). A visitor concludes "one working agent" when you have two live and a real roadmap. Fix: Scout gets a card; add "coming soon" cards for the pipeline so the roster reads as a growing *team*.
- **Features are behind the product.** The six tiles describe Clem/Scout basics and say nothing about what you've shipped since: **FAQ pages + schema, native Shopify publishing, internal linking / hub-and-spoke, IndexNow / AI-search visibility, AEO (answer-engine optimisation)**. The single most on-trend selling point right now — "get cited by ChatGPT/Perplexity, not just Google" — is completely absent.
- **No proof.** No results, no numbers, no logos, no testimonials. For a service whose whole pitch is "we grow brands", the absence of a single outcome is the biggest conversion gap.

## 2. Dogfooding & SEO credibility (the elephant)

- **Your own blog is on a subdomain** (`blog.nobrandleftbehind.com`) — the exact anti-pattern you're migrating clients *off*. Meanwhile the app already has a native `/blog` renderer. An SEO company blogging on a subdomain is a live contradiction a savvy prospect will notice.
- **The marketing site has no `sitemap`/`robots`.** Only `app/blog/` has them; there's no root `app/sitemap.ts` / `app/robots.ts` for the marketing pages. A company selling SEO must ship these.
- **Thin content.** It's essentially one page. There's no content cluster, no FAQ, no depth for Google or AI engines to chew on — none of the substance your own tools (Clem, the FAQ builder, Bailey) are designed to produce.
- **No structured data** beyond OpenGraph. No `Organization`, no `SoftwareApplication`/`Product`, no `FAQPage`. Easy wins you'd insist a client do.

**Principle for the whole rebuild:** the marketing site should be *built and grown by your own agents* — Clem writes the blog, the FAQ tool builds the FAQ, Bailey handles imagery, Pam sets the cadence. That's simultaneously your best demo, your best case study, and your SEO engine.

## 3. Conversion & trust

- **No pricing page.** Even a "free beta / contact us" pricing page is one of the most-visited pages on any SaaS site, and its absence adds friction. You already have per-workspace/site limits in the app — those are your natural tiers.
- **Academy is placeholder.** A static, aspirational course catalogue that isn't real can read as thin or vapourware. Either make one course real or park it behind "coming soon".
- **CTA is a mailto + "get started free".** Fine, but there's no lead-capture form, no demo booking flow, and the contact route doesn't use the CRM lead webhook you already built for the brand sites.
- **No About/story, no legal pages** (terms, privacy) — the latter you'll need before taking real signups.

---

## 4. New pages to add (with rationale)

**High priority**

1. **Per-agent pages** — `/agents/clem`, `/agents/scout` (live), plus `/agents/hank|bailey|pam` as "coming soon". Each a proper page: what it does, how it works, a screenshot/gif, the outcome, its own CTA, and `Product` schema. Wins on both fronts — they rank for "AI blog writing agent", "SEO rank-tracking agent", etc., *and* give the homepage roster somewhere to click into.
2. **Pricing** — `/pricing`. Clarify the model (free beta now; tiers by workspace/site count later). Reduces friction, captures intent.
3. **Results / case studies** — `/results` or `/case-studies`. Your dogfood is the story: "how Clem + Scout grow Putterfingers / MerchyCart", with real rank/traffic movement. This is your strongest untapped asset — you have the data.
4. **FAQ** — `/faq`, built with your own FAQ tool (FAQPage schema, AI-citation-ready). Meta-credibility: "this page was built by the product."

**Medium priority**

5. **Own blog at `/blog`** (or `/learn`) — migrate off the subdomain and publish a Clem-written content cluster (content marketing, SEO, AEO, "how to brief an AI writer"). The flagship dogfood move.
6. **Use cases / "Who it's for"** — `/for/shopify-brands`, `/for/local-business`, `/for/agencies`. Segment-specific relevance + long-tail SEO.
7. **Comparison pages** — "NBLB vs a content agency", "vs doing it yourself", "vs [tool]". High-intent, high-converting search traffic.
8. **Contact** — `/contact` with a real form wired to the Event Stuff CRM lead webhook you already built (reuse, don't rebuild).

**Lower priority / housekeeping**

9. **About / story** — `/about`. Who's behind it, why — trust.
10. **Legal** — `/terms`, `/privacy`. Required before real signups.
11. **Academy** — make one course real or gate it as "coming soon".

## 5. Technical SEO fixes

- Add `app/sitemap.ts` + `app/robots.ts` for the marketing site.
- Add `Organization` + `SoftwareApplication`/`Product` JSON-LD to the homepage; `Product` on each agent page; `FAQPage` on the FAQ.
- Move the blog off the subdomain onto `/blog` (and 301 the old subdomain URLs — same playbook you're running for the brand sites).
- Ensure the marketing pages are in one sitemap and internally linked (nav + footer + contextual).

---

## 6. Suggested sequence

1. **Quick credibility pass (hours):** update the homepage roster (add Scout; pipeline cards) + rewrite the feature grid to match the shipped product (FAQ/schema, Shopify-native, internal linking, IndexNow/AI-search, AEO). Add `Organization`/`SoftwareApplication` schema + a root sitemap/robots.
2. **Conversion pages:** `/pricing`, per-agent pages, `/faq` (via your own tool).
3. **The dogfood flagship:** own blog on `/blog` + a first Clem content cluster; then `/results` with real numbers as they accrue.
4. **Trust & housekeeping:** `/about`, `/contact` (CRM-wired), `/terms`, `/privacy`; resolve Academy.

The throughline: make the marketing site the thing the product produces. Every capability you sell (SEO blog, FAQ, internal linking, AI-search visibility, soon galleries via Bailey and cadence via Pam) should be visibly *running on your own site* — the most persuasive demo you can give.
