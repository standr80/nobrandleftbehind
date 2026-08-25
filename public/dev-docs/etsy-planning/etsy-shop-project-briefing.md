# Etsy Shop Project — Briefing for AI Handoff

## Who this is for
Richard is Managing Director of Event Stuff Ltd, a UK portfolio including **Designsonprint** and **Merchycart** (print/POD fulfilment businesses), **Photocutouts**, and **Putterfingers**. He already prints and dispatches on behalf of some Etsy sellers as a fulfilment service. He's exploring launching his own Etsy shop(s), built and run with heavy AI/automation support.

## The goal
Build a semi-automated pipeline to identify winning product categories on Etsy, generate original listings (copy, tags, taxonomy), and publish to Etsy — using Richard's existing print/dispatch capability as the fulfilment backend.

## Key decision already made: NOT copying competitors directly
Early in this project we considered directly replicating competitor bestsellers (their exact designs/images/copy). **This was explicitly ruled out** — copying competitor images or description text is copyright infringement, and closely replicating a seller's distinctive original artwork carries real IP risk. This constraint should be treated as fixed, not re-litigated.

### What IS in scope (agreed approach):
- **Market research**: analyse competitor bestsellers to extract *category-level facts only* — item type, dimensions, materials, price point, audience/occasion, popularity signals (sales count, favourites, review volume). No copying of text or images from this research.
- **Original listing copy**: titles, descriptions, tags generated fresh from the product spec/facts — never reworded versions of a competitor's actual text.
- **Original product images**: either AI-generated mockups of Richard's own printed output, or real photos once a physical sample is printed. Never competitor images.
- **Taxonomy/category matching**: pulled automatically via Etsy's API based on product type.
- A **filler-image placeholder system** was proposed so product records can be structurally complete in the local DB before real images exist — filler-flagged items must never sync live to Etsy.

## Nuance flagged but unresolved
Whether "copying a bestseller" means just the **item type/format** (safe — e.g. "totes are popular, let's make totes") or extends to **replicating specific artwork/design** (risky — needs case-by-case judgement, not full automation) was raised as an open question. Richard's answer: **"not sure yet — depends what sells."** Recommendation given: build a `source_type` / review-flag field so format-driven products can auto-publish, but design-led products get routed to manual review rather than auto-generated/published. This distinction should inform any future listing-generation logic.

## Technical architecture discussed (not yet built)
- Local product database (Richard uses **Supabase** across his other projects — NBLB, CourseAuthors.com — so likely the natural choice here too, though nothing is built yet).
- Sync pipeline into **Etsy Open API v3** using Etsy's Seller App (self-shop OAuth, approved quickly for one's own shop).
- Etsy also runs an official **OpenAPI Dev MCP server** compatible with Claude Code/Cursor — useful for scaffolding the integration quickly, since Richard's dev workflow is Cursor + Claude Code + Claude API already.
- Etsy listings are created as drafts first; variations/inventory are set via a separate follow-up API call (`updateListingInventory`) after listing creation.
- API calls should be throttled — sudden bulk listing activity on a new shop can trigger review flags.

## Data-gathering constraint — important
Etsy **blocks automated scraping** of search and shop pages (robots.txt disallow), and more importantly, **scraping violates Etsy's Terms of Service** regardless of whether a tool (e.g. Firecrawl) can technically bypass the block. Recommendation given: don't scrape Etsy, even if technically feasible — the risk isn't worth it given Richard has real revenue tied to Etsy via his fulfilment client relationships.

**Approved alternatives for competitor research:**
- Manual browsing + pasting listing details (title, price, review/sales counts) into chat for structuring — this is what's actually been used so far.
- Third-party compliant tools: eRank, Alura, Marmalead — Etsy SEO/research tools that use approved integrations rather than scraping.
- Once Richard's own shop exists, full automation via his own authorised API access is fine.

## Case study in progress
Richard identified **DIYPaperPrints** (Wedding & Event Printables & Templates, ~4,650 reviews) as a shop of interest — it's unclear yet whether this is (a) an existing print/dispatch client of Richard's, or (b) a shop being studied purely as a market model. This wasn't resolved in conversation — worth clarifying before treating any of its data as either "our client" (no IP issue at all) or "competitor" (research-only, no copying).

## Status / next steps not yet actioned
- No database schema has been built yet (deliberately deferred).
- No competitor product data has been formally captured/ranked yet — waiting on either pasted listing details or a compliant research tool.
- No code/sync script has been written yet.
- Open question above (item-type-only vs artwork-too) needs Richard's steer before listing-generation logic is finalised.
