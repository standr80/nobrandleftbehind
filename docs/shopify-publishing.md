# Publishing Clem posts to Shopify

NBLB can publish blog posts directly into a Shopify store's **native blog** via
the GraphQL Admin API. Native articles are server-rendered by Shopify (SEO-grade,
no JS embed) and live at:

```
https://<your-store>/blogs/<blog-handle>/<article-handle>
```

The `/blogs/` prefix is fixed by Shopify and can't be removed. You control the
`<blog-handle>` (middle segment) by choosing/naming the blog, and Clem sets the
`<article-handle>` from the post slug.

---

## 1. Create an app in the Dev Dashboard (per store)

Since **Jan 2026 you can no longer create custom apps in the Shopify admin** —
new apps are made in the **Dev Dashboard** and authenticate with the OAuth
*client credentials* grant (a Client ID + Secret, not a static `shpat_` token).
This is the right model for apps you own installed on stores you own.

Do this once for each store (Putterfingers, Photocutouts):

1. Go to the **Dev Dashboard** at <https://dev.shopify.com/dashboard> and sign in with the account that owns the store.
2. **Create an app** and name it (e.g. `NBLB / Clem`).
3. In the app's **Configuration / access scopes**, add:
   - `write_content` (required — lets Clem create/update articles)
   - `read_content` (recommended)
   Save a version so the scopes take effect.
4. **Install** the app on the store (choose the store and confirm). Client
   credentials only works once the app is installed on the store.
5. Open the app's **Settings** page and copy the **Client ID** and **Client secret**.
   Keep the secret safe — you'll paste both into NBLB (step 3).

Also note the store's **admin domain** — the `*.myshopify.com` one (e.g.
`putterfingers.myshopify.com`), not your public `www` domain. Find it in the
store's **Settings → Domains**.

> Already have a *legacy* admin-created custom app (made before 2026)? Those
> still work — use its static `shpat_` Admin API token in the "Legacy static
> token" field in NBLB instead of Client ID/Secret. New apps should use the
> Dev Dashboard route above.

## 2. Find (or create) the target blog and its ID

Shopify stores can have multiple blogs. Pick the one Clem should post into.

1. In admin go to **Content → Blog posts**, then **Manage blogs** (or **Content → Blogs**).
2. To get `/blogs/blog/...` create a new blog titled **Blog** (Shopify derives the
   handle `blog` from the title). To keep the default `/blogs/news/...`, use the
   existing **News** blog.
3. Click into the blog. The numeric **blog ID** is in the browser address bar:
   `.../admin/blogs/**XXXXXXXXX**`. Copy that number.

## 3. Configure the tenant in NBLB

In NBLB, open the workspace for that store → **Settings → Publishing**:

1. Set **Export / publish method** to **Shopify**.
2. Fill in:
   - **Shop domain** — `your-store.myshopify.com`
   - **Client ID** and **Client Secret** — from the Dev Dashboard app (step 1). NBLB exchanges these for a fresh 24h token on each publish.
   - **Blog ID** — the number from step 2
   - **API version** — leave blank (defaults to a stable recent version) unless you need a specific one
   - **Public store URL** — `https://www.putterfingers.com` (used only to build the article links; defaults to the shop domain)
   - **Legacy static token** — leave blank (only used for old admin-created custom apps instead of Client ID/Secret)
3. **Save.**

## 4. Test

1. In Clem, take a draft through review to **Publish now** (or schedule it and let the cron fire).
2. NBLB calls Shopify's `articleCreate`, marks the post published, and stores the
   returned article ID + public URL on the post.
3. Check the post appears in Shopify admin under **Content → Blog posts**, and open
   the live URL (`/blogs/<blog>/<slug>`).

Re-publishing an already-pushed post updates the same Shopify article (no
duplicates) — NBLB remembers the article ID.

## FAQ posts → a dedicated FAQ blog

FAQ content (Clem posts with `content_type = 'faq'`) publishes as an **article in
a separate Shopify blog** — e.g. a blog with handle `faqs`, giving
`/blogs/faqs/<slug>`. Shopify auto-lists every FAQ at `/blogs/faqs` (that page is
your FAQ index), and each FAQ keeps its own URL plus **FAQPage** JSON-LD (from the
post's `faq_items`) for rich results / AI-overview citations. Regular posts keep
going to the main blog (`/blogs/<blog>/<slug>`).

Benefit: **one menu link** to `/blogs/faqs`, added once — every new FAQ group then
appears on the index automatically, no per-page admin.

Setup (once per store):
1. In Shopify admin, **Content → Blogs → Add blog**, name it e.g. **FAQs** (handle becomes `faqs` → `/blogs/faqs`).
2. Open the blog and copy its numeric **Blog ID** from the admin URL (`.../content/blogs/**NNN**`).
3. In NBLB Settings → Publishing, paste it into **FAQ Blog ID** (separate from the main **Blog ID**).
4. Add `/blogs/faqs` to your store's menu (**Content → Menus**) once.

Unpublishing a FAQ hides the article; deleting removes it. (Any FAQ published as a
`/pages/...` page before this change is cleaned up automatically on delete.)

## Internal linking (automatic)

Every published post gets a **"Related reading"** block appended to its body,
linking to its most related published siblings (same content type, ranked by
shared tags). It's delimited by HTML comments (`<!--nblb-related-start--> …
<!--nblb-related-end-->`) so it can be rewritten cleanly. Publishing a new post
also **retroactively** refreshes the block on those related older posts so they
link forward to the new one — internal-link equity flows both ways with no manual
work. This is best-effort: a linking hiccup never blocks the publish itself.

## IndexNow (faster AI/search discovery)

ChatGPT search runs on Bing, and Shopify doesn't ping IndexNow — so new content
can wait days to surface. With IndexNow configured, Clem notifies Bing on publish
and content appears in hours. One-time setup per store:

1. Generate a key (any 8–128 char hex/GUID string; e.g. from an online IndexNow key generator).
2. Create a UTF-8 text file named `{key}.txt` whose only content is the key.
3. In Shopify admin, **Settings → Files**, upload that `.txt` file, and copy its CDN URL.
4. In NBLB Settings → Publishing, set **IndexNow key** (the key) and **IndexNow key file URL** (the CDN URL from step 3).
5. (Recommended) Add the site in **Bing Webmaster Tools** so you can see submissions.

Notes: the ping uses your **Public store URL** as the host, so make sure that
field is set to the public domain (not the `myshopify.com` one). Leave the key
fields blank to disable. The ping is best-effort and never blocks publishing.

## Notes & limits (v1)

- **Hero images:** only included if the post's hero image is a public `http(s)` URL.
  Repo-relative image paths are skipped (they don't exist on the Shopify CDN).
- **Author:** uses the post's assigned author, else the tenant's default author,
  else the workspace name. Set a default author in **Settings → Authors** for good
  E-E-A-T attribution.
- **Old subdomain blogs (blog.putterfingers.com / blog.photocutouts.co.uk):** the
  301 redirects from old → new URLs must be set up on the WordPress/subdomain host,
  **not** in Shopify. Shopify's URL redirects only cover paths on the Shopify domain.
- **Scopes:** if you see a `403`/access error at publish time, re-check the app has
  `write_content` and was re-installed after adding the scope.
