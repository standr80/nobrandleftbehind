# Designs on Print — Blog Embed (developer handover)

This embeds the Designs on Print blog onto the main website. Posts are written
and managed elsewhere (in the NBLB / Clem platform) and delivered to the page via
a small JavaScript embed — no CMS, database, or build step is needed on the
website side. New and updated posts appear automatically; nothing needs
re-deploying when content changes.

## What to do

1. Create (or use) the page you want to be the blog, e.g. `https://www.designsonprint.com/blog`.
2. Paste these two lines into the **content area** of that page — i.e. inside the
   normal page body, between the site's existing header/nav and footer:

```html
<div id="nblb-blog"></div>
<script src="https://www.nobrandleftbehind.com/blog.js" data-tenant="designsonprint"></script>
```

That's it. The script fills the `<div>` with the blog: a post list with a
"Browse by topic" sidebar and pagination, and individual post pages.

## How it behaves

- **Post pages** open in place at `…/blog?post=<slug>` (e.g.
  `https://www.designsonprint.com/blog?post=billboard-posters`). This is
  client-side routing, so **no server rewrite/wildcard config is required** — the
  single `/blog` page handles both the list and individual posts. Browser
  Back/Forward and "open in new tab" all work.
- **Styling** is pulled automatically from the brand (colours, fonts) and the
  blog is rendered in an isolated Shadow DOM, so the site's own CSS won't clash
  with it and vice-versa. The surrounding page header, nav and footer stay as-is.
- **SEO / authors** — article metadata and author bylines are included; for the
  strongest SEO the platform also offers a server-rendered version (see "Notes").

## Options (attributes on the `<script>` tag)

| Attribute | Default | Purpose |
|---|---|---|
| `data-tenant` | — | **Required.** Must be `designsonprint`. |
| `data-target` | `#nblb-blog` | CSS selector of the container to render into (change if `#nblb-blog` clashes with something). |
| `data-page-size` | `6` | Posts per page. |
| `data-accent` | brand colour | Override the accent colour, e.g. `data-accent="#00aeef"`. |

Example with options:

```html
<div id="nblb-blog"></div>
<script src="https://www.nobrandleftbehind.com/blog.js"
        data-tenant="designsonprint"
        data-page-size="9"></script>
```

## Notes

- **JavaScript is required** to render the blog (it's a client-side embed). A
  `<noscript>` fallback message is advisable for the rare no-JS visitor.
- **CORS / domains** — the embed works from any domain; no allow-listing needed.
- **No keys or secrets** are involved; the snippet is safe to commit to the site.
- **Old subdomain** — if `blog.designsonprint.com` is being retired in favour of
  `/blog`, consider 301-redirecting the old subdomain (and any
  `blog.designsonprint.com/<slug>` URLs) to the new `/blog` location to preserve
  search rankings. Happy to advise on the mapping.

## Questions

Integration owner: Richard (richard@eventstuff.ltd).
