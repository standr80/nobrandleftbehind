# NBLB Blog Embed — setup

A single script that turns any page on any website into a full `/blog` —
post list, individual post pages, and tag filtering — pulling from the
Content API v1 and auto-styling to the tenant's brand.

## Install (client side, one time, no developer needed)

On the page you want to be the blog (e.g. `yoursite.com/blog`), paste:

```html
<div id="nblb-blog"></div>
<script src="https://www.nobrandleftbehind.com/blog.js" data-tenant="YOUR-TENANT-SLUG"></script>
```

That's it. The host page's own header, nav and footer stay; the script fills
the `#nblb-blog` container with the blog. The tenant slug is the one used by
the Content API (e.g. `designsonprint`).

## Options

| Attribute | Default | Purpose |
|---|---|---|
| `data-tenant` | — | **Required.** Content API tenant slug. |
| `data-target` | `#nblb-blog` | CSS selector of the container to render into. |
| `data-page-size` | `12` | Posts per page (Load more fetches the next page). |
| `data-accent` | theme `primaryColor` | Override the accent colour. |
| `data-api` | script origin | API origin override (rarely needed). |

## How it behaves

- **List view** — two-column layout: a responsive card grid (hero image, title,
  excerpt, date, tags) with a sticky **"Browse by topic"** sidebar on the right.
- **Sidebar** — shows the tenant's **top 8 tags by post count** (with counts),
  not every tag, so a long tag list never spills across the top. "All topics"
  expands the full list; selecting a tag filters the grid and an "All posts" link
  clears it. Sidebar drops below the grid on mobile.
- **Pagination** — numbered pager (Prev / 1 … N / Next). Page size is set by
  `data-page-size` (default 6).
- **Post view** — click a card; the post opens in place and the URL becomes
  `?post=slug` so it is shareable and Back/Forward work. Real `<a href>` links
  mean right-click → open in new tab also works.
- **Theme** — colours and fonts come from the tenant's `/theme` endpoint, so the
  blog matches the brand out of the box. The footer line (if set) renders at the
  bottom.
- **Isolation** — rendered inside a Shadow DOM, so host-page CSS can't break it
  and its styles can't leak out.

## Testing

Open `public/blog-demo.html` in a browser (it points at the live API and the
`designsonprint` tenant). Confirm: list loads, a post opens with `?post=` in the
URL, Back returns to the list, tag filter works.

## Known limits (by design, for now)

- **SEO:** content is rendered client-side, so crawl/index value is limited. This
  is the trade-off for zero-config install. The WordPress plugin (server-rendered
  into native posts) is the SEO-grade path for clients who need it.
- **URLs:** posts live at `…/blog?post=slug`, not `…/blog/slug`. Path-based URLs
  need per-platform wildcard routing and aren't worth it given the SEO point above.
- **Tag list** is built from posts loaded so far, not the tenant's full tag set.

## Per-brand status

- `designsonprint` — onboarded, has published posts, ready to embed.
- `putterfingers`, `photocutouts`, `merchycart` — **not yet onboarded as tenants**;
  onboard each (and let Clem publish) before the embed has content to show.
