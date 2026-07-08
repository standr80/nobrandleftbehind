import { createAdminClient } from '@/lib/supabase/admin'
import { toHtml } from '@/lib/mdx/toHtml'
import { parseFaqItems, faqPageSchema } from '@/lib/content/api'
import { pingIndexNow } from '@/lib/clem/indexNow'

/**
 * Publishes a Clem blog post into a Shopify store's NATIVE blog via the
 * GraphQL Admin API (articleCreate / articleUpdate).
 *
 * Why native + GraphQL:
 *  - Native articles are server-rendered by Shopify at
 *    /blogs/{blog-handle}/{article-handle} — SEO-grade, no JS embed.
 *  - Shopify made the REST Admin API legacy (Oct 2024); new integrations must
 *    use GraphQL. articleCreate requires the `write_content` access scope.
 *
 * Auth: Dev Dashboard apps (the only way to create new custom apps since Jan
 * 2026) use the OAuth client credentials grant. We exchange the app's
 * client_id + client_secret for a 24h access token at publish time and send it
 * as the X-Shopify-Access-Token header. Legacy admin-created custom apps that
 * still issue a static shpat_ token are supported as a fallback.
 *
 * Idempotent: if the post already has a shopify_article_id we update that
 * article instead of creating a duplicate.
 */

const DEFAULT_SHOPIFY_API_VERSION = '2025-10'

interface AuthorRecord {
  name: string | null
  job_title: string | null
  bio: string | null
  links: unknown
  slug: string | null
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  )
}

/** Normalise the authors.links jsonb ([{label,url}]) to a clean array. */
function authorLinks(links: unknown): { label: string; url: string }[] {
  if (!Array.isArray(links)) return []
  return (links as unknown[])
    .map((l) => (l && typeof l === 'object' ? (l as { label?: string; url?: string }) : null))
    .filter((l): l is { label?: string; url?: string } => Boolean(l && l.url))
    .map((l) => ({ label: String(l.label ?? l.url), url: String(l.url) }))
}

/**
 * Render an "About the author" box as inline-styled HTML appended to the
 * article body. Shopify's native article author is only a name string, so bio /
 * job title / links can't live in a native field — we surface them on-page here
 * (self-contained inline styles so it renders regardless of the store theme).
 */
function buildAuthorBioHtml(author: AuthorRecord | null): string {
  if (!author?.name) return ''
  const links = authorLinks(author.links)
  // Nothing beyond the name (already shown as the byline) — skip the box.
  if (!author.bio && !author.job_title && links.length === 0) return ''

  const linksHtml = links.length
    ? `<p style="margin:0;display:flex;gap:1rem;flex-wrap:wrap">${links
        .map(
          (l) =>
            `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer" style="text-decoration:underline">${escapeHtml(l.label)}</a>`
        )
        .join('')}</p>`
    : ''

  return (
    `<div style="margin-top:2.5rem;padding:1.25rem 1.5rem;border:1px solid #e5e7eb;border-radius:0.75rem;background:#f9fafb">` +
    `<p style="margin:0 0 .5rem;font-weight:700;font-size:.8rem;letter-spacing:.04em;text-transform:uppercase;opacity:.6">About the author</p>` +
    `<p style="margin:0 0 .35rem;font-weight:600">${escapeHtml(author.name)}` +
    (author.job_title ? `<span style="font-weight:500;opacity:.7"> · ${escapeHtml(author.job_title)}</span>` : '') +
    `</p>` +
    (author.bio ? `<p style="margin:0 0 .5rem;font-size:.9rem;line-height:1.6;opacity:.85">${escapeHtml(author.bio)}</p>` : '') +
    linksHtml +
    `</div>`
  )
}

/**
 * BlogPosting + Person JSON-LD for E-E-A-T (jobTitle + sameAs from author
 * links). Appended into the body so author credentials are machine-readable
 * even though Shopify's native author field can't carry them.
 */
function buildAuthorJsonLd(
  author: AuthorRecord | null,
  publisherName: string,
  title: string,
  description: string | null,
  publishedAt: string | null
): string {
  const sameAs = authorLinks(author?.links).map((l) => l.url)
  const authorNode =
    author?.name
      ? {
          '@type': 'Person',
          name: author.name,
          ...(author.job_title ? { jobTitle: author.job_title } : {}),
          ...(sameAs.length ? { sameAs } : {}),
        }
      : { '@type': 'Organization', name: publisherName }

  const data = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    ...(description ? { description } : {}),
    ...(publishedAt ? { datePublished: publishedAt } : {}),
    author: authorNode,
    publisher: { '@type': 'Organization', name: publisherName },
  }
  // Escape '<' so a stray sequence can't break out of the <script> element.
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  return `<script type="application/ld+json">${json}</script>`
}

/**
 * Obtain an Admin API access token for the shop.
 *  - Preferred: client credentials grant (Dev Dashboard app) — POST client_id +
 *    client_secret to /admin/oauth/access_token, returns a token valid 24h.
 *    Publishing is infrequent, so we fetch a fresh token per run (stateless,
 *    serverless-safe — no cache to go stale across cold starts).
 *  - Fallback: a static token from a legacy admin-created custom app.
 */
async function getAccessToken(
  shopDomain: string,
  opts: { clientId?: string | null; clientSecret?: string | null; staticToken?: string | null }
): Promise<string> {
  if (opts.clientId && opts.clientSecret) {
    const res = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: opts.clientId,
        client_secret: opts.clientSecret,
      }),
    })
    const text = await res.text()
    if (!res.ok) {
      throw new Error(`[shopify] token request failed (HTTP ${res.status}): ${text.slice(0, 300)}`)
    }
    let json: { access_token?: string }
    try {
      json = JSON.parse(text)
    } catch {
      throw new Error(`[shopify] token response was not JSON: ${text.slice(0, 300)}`)
    }
    if (!json.access_token) throw new Error('[shopify] token response had no access_token')
    return json.access_token
  }

  if (opts.staticToken) return opts.staticToken

  throw new Error(
    '[shopify] No credentials: set shopify_client_id + shopify_client_secret (Dev Dashboard app) or a legacy shopify_access_token.'
  )
}

interface ShopifyUserError {
  code?: string | null
  field?: string[] | null
  message: string
}

interface ArticleResult {
  id: string
  handle: string
  blog?: { handle?: string | null } | null
}

/** Normalise a shop domain: strip protocol, path and trailing slash. */
function normaliseShopDomain(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/\/$/, '')
}

/** Wrap a bare numeric blog id in a Shopify GID, or pass a GID through. */
function toBlogGid(raw: string): string {
  const v = raw.trim()
  return v.startsWith('gid://') ? v : `gid://shopify/Blog/${v.replace(/\D/g, '')}`
}

/** POST a GraphQL query to the Shopify Admin API and return data (throws on errors). */
async function shopifyGraphql<T>(
  shopDomain: string,
  apiVersion: string,
  accessToken: string,
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  const endpoint = `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({ query, variables }),
  })

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`[shopify] HTTP ${res.status} from ${endpoint}: ${text.slice(0, 500)}`)
  }

  let json: { data?: T; errors?: Array<{ message: string }> }
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`[shopify] Non-JSON response: ${text.slice(0, 500)}`)
  }

  if (json.errors?.length) {
    throw new Error(`[shopify] GraphQL errors: ${json.errors.map((e) => e.message).join('; ')}`)
  }
  if (!json.data) {
    throw new Error('[shopify] GraphQL response had no data')
  }
  return json.data
}

const ARTICLE_FIELDS = `
  article { id handle blog { handle } }
  userErrors { code field message }
`

const CREATE_MUTATION = `mutation ClemCreateArticle($article: ArticleCreateInput!) {
  articleCreate(article: $article) { ${ARTICLE_FIELDS} }
}`

const UPDATE_MUTATION = `mutation ClemUpdateArticle($id: ID!, $article: ArticleUpdateInput!) {
  articleUpdate(id: $id, article: $article) { ${ARTICLE_FIELDS} }
}`

const ARTICLE_DELETE_MUTATION = `mutation ClemDeleteArticle($id: ID!) {
  articleDelete(id: $id) { deletedArticleId userErrors { code field message } }
}`

// Page mutations are retained only to clean up LEGACY FAQ pages (FAQs published
// as /pages/<slug> before they moved to a dedicated FAQ blog). New FAQs are
// articles in the FAQ blog. We branch unpublish/delete on the stored GID type.
const PAGE_FIELDS = `
  page { id handle }
  userErrors { code field message }
`

const PAGE_UPDATE_MUTATION = `mutation ClemUpdatePage($id: ID!, $page: PageUpdateInput!) {
  pageUpdate(id: $id, page: $page) { ${PAGE_FIELDS} }
}`

const PAGE_DELETE_MUTATION = `mutation ClemDeletePage($id: ID!) {
  pageDelete(id: $id) { deletedPageId userErrors { code field message } }
}`

/** True if a stored Shopify GID refers to a Page (legacy FAQ) vs an Article. */
function gidIsPage(gid: string | null | undefined): boolean {
  return !!gid && gid.includes('/Page/')
}

// Read an article's current HTML body so we can idempotently refresh only its
// "Related reading" block (retroactive internal linking).
const ARTICLE_BODY_QUERY = `query ClemGetArticleBody($id: ID!) {
  article(id: $id) { body }
}`

// ── Related reading (internal linking) ──────────────────────────────────────
// A "Related reading" block is delimited by HTML comments so it can be rewritten
// idempotently on every publish without touching the surrounding prose.
const RELATED_START = '<!--nblb-related-start-->'
const RELATED_END = '<!--nblb-related-end-->'

interface RelatedItem {
  title: string
  url: string
}

function relatedReadingBlock(items: RelatedItem[]): string {
  if (!items.length) return ''
  const lis = items
    .map((it) => `<li><a href="${escapeHtml(it.url)}">${escapeHtml(it.title)}</a></li>`)
    .join('')
  return (
    RELATED_START +
    `<div style="margin-top:2.5rem;padding-top:1.25rem;border-top:1px solid #e5e7eb">` +
    `<p style="margin:0 0 .5rem;font-weight:700;font-size:.8rem;letter-spacing:.04em;text-transform:uppercase;opacity:.6">Related reading</p>` +
    `<ul style="margin:0;padding-left:1.25rem;line-height:1.7">${lis}</ul>` +
    `</div>` +
    RELATED_END
  )
}

/** Replace the delimited related block (or append it, or remove it). Idempotent. */
function upsertRelatedBlock(html: string, block: string): string {
  const start = html.indexOf(RELATED_START)
  const end = html.indexOf(RELATED_END)
  if (start !== -1 && end !== -1 && end > start) {
    return html.slice(0, start) + block + html.slice(end + RELATED_END.length)
  }
  return block ? html + block : html
}

type Db = ReturnType<typeof createAdminClient>

interface RelatedRow {
  id: string
  title: string
  content_type: string
  tags: string[] | null
  cluster_id: string | null
  shopify_article_id: string | null
  shopify_article_url: string | null
}

// Cluster money-page link (hub-and-spoke): the pinned first entry in a post's
// Related-reading block, funnelling authority to the cluster's commercial page.
type ClusterDef = { name?: string; money_url?: string; money_label?: string }
function clusterMoneyItem(clusters: unknown, clusterId: string | null): RelatedItem | null {
  if (!clusterId || !Array.isArray(clusters)) return null
  const c = (clusters as ClusterDef[]).find((x) => x && x.name === clusterId && x.money_url)
  if (!c?.money_url) return null
  return { title: c.money_label || c.name || 'Learn more', url: c.money_url }
}

/**
 * Published siblings of `post` in the same content type, ranked by shared-tag
 * overlap then recency. Used to build the Related-reading block.
 */
async function getRelatedPublished(
  db: Db,
  tenantId: string,
  post: { id: string; content_type: string; tags: string[] | null },
  limit = 3
): Promise<RelatedRow[]> {
  const { data } = await db
    .from('blog_posts')
    .select('id, title, content_type, tags, cluster_id, shopify_article_id, shopify_article_url, published_at')
    .eq('tenant_id', tenantId)
    .eq('status', 'published')
    .eq('content_type', post.content_type)
    .neq('id', post.id)
    .not('shopify_article_id', 'is', null)
    .order('published_at', { ascending: false })
    .limit(50)

  const rows = (data ?? []) as RelatedRow[]
  const mine = new Set((post.tags ?? []).map((t) => t.toLowerCase()))
  return rows
    .map((r) => ({ r, overlap: (r.tags ?? []).filter((t) => mine.has(t.toLowerCase())).length }))
    // Require at least one shared tag — a forced block of tenuously related
    // links is worse than no block, so weak matches show fewer/none.
    .filter((s) => s.overlap >= 1)
    .sort((a, b) => b.overlap - a.overlap) // rows already come recency-ordered
    .slice(0, limit)
    .map((s) => s.r)
}

function relatedItemsFrom(rows: RelatedRow[]): RelatedItem[] {
  return rows
    .filter((r) => r.shopify_article_url)
    .map((r) => ({ title: r.title, url: r.shopify_article_url as string }))
}

/**
 * Retroactively refresh one older article's Related-reading block to include the
 * newly published post. Reads the live body and rewrites only the delimited
 * block. Best-effort — throws are caught by the caller so linking never blocks
 * the main publish.
 */
async function refreshRelatedBlock(
  db: Db,
  shopDomain: string,
  apiVersion: string,
  accessToken: string,
  tenantId: string,
  newPostId: string,
  clusters: unknown,
  y: RelatedRow
): Promise<void> {
  if (!y.shopify_article_id || gidIsPage(y.shopify_article_id)) return
  const rel = await getRelatedPublished(
    db,
    tenantId,
    { id: y.id, content_type: y.content_type, tags: y.tags },
    3
  )
  // Churn guard: only rewrite this older article if the new post actually makes
  // its related set (i.e. displaces a weaker entry). Otherwise leave it alone —
  // avoids rewriting the same popular articles on every publish.
  if (!rel.some((r) => r.id === newPostId)) return
  const pinned = clusterMoneyItem(clusters, y.cluster_id)
  const block = relatedReadingBlock([...(pinned ? [pinned] : []), ...relatedItemsFrom(rel)])

  const read = await shopifyGraphql<{ article: { body: string | null } | null }>(
    shopDomain,
    apiVersion,
    accessToken,
    ARTICLE_BODY_QUERY,
    { id: y.shopify_article_id }
  )
  const currentBody = read.article?.body ?? ''
  if (!currentBody) return
  const newBody = upsertRelatedBlock(currentBody, block)
  if (newBody === currentBody) return

  const res = await shopifyGraphql<{ articleUpdate: { userErrors: ShopifyUserError[] } }>(
    shopDomain,
    apiVersion,
    accessToken,
    UPDATE_MUTATION,
    { id: y.shopify_article_id, article: { body: newBody } }
  )
  if (res.articleUpdate.userErrors?.length) {
    throw new Error(res.articleUpdate.userErrors.map((e) => e.message).join('; '))
  }
}

/** Wrap a schema.org object as a JSON-LD <script> (escaping '<' for safety). */
function jsonLdScript(obj: object | null): string {
  if (!obj) return ''
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`
}

export async function runShopifyPublish(tenantId: string, postId: string): Promise<void> {
  const db = createAdminClient()

  // ── 1. Load post + tenant ──────────────────────────────────────────────────
  const [{ data: post, error: postErr }, { data: tenant, error: tenantErr }] =
    await Promise.all([
      db.from('blog_posts').select('*').eq('id', postId).single(),
      db
        .from('tenants')
        .select(
          'cms_type, name, blog_theme, shopify_shop_domain, shopify_client_id, shopify_client_secret, shopify_access_token, shopify_blog_id, shopify_faq_blog_id, shopify_api_version, shopify_store_url, indexnow_key, indexnow_key_location, content_clusters'
        )
        .eq('id', tenantId)
        .single(),
    ])

  if (postErr || !post) throw new Error(`[shopify] Post not found: ${postId}`)
  if (tenantErr || !tenant) throw new Error(`[shopify] Tenant not found: ${tenantId}`)

  // ── 2. Validate config ─────────────────────────────────────────────────────
  if (tenant.cms_type !== 'shopify') {
    throw new Error(`[shopify] Tenant cms_type is '${tenant.cms_type}', expected 'shopify'`)
  }
  // FAQ posts publish into a dedicated FAQ blog (/blogs/faqs); everything else
  // into the main blog. Same store + scope — just a different blog id.
  const isFaq = post.content_type === 'faq'
  const shopDomainRaw = tenant.shopify_shop_domain
  const blogIdRaw = isFaq ? tenant.shopify_faq_blog_id : tenant.shopify_blog_id
  const hasCreds =
    (tenant.shopify_client_id && tenant.shopify_client_secret) || tenant.shopify_access_token
  if (!shopDomainRaw || !hasCreds || !blogIdRaw) {
    throw new Error(
      `[shopify] Tenant ${tenantId} has incomplete Shopify config. Set shopify_shop_domain, ` +
        `${isFaq ? 'shopify_faq_blog_id' : 'shopify_blog_id'} and either shopify_client_id + shopify_client_secret or shopify_access_token.`
    )
  }

  const shopDomain = normaliseShopDomain(shopDomainRaw)
  const apiVersion = tenant.shopify_api_version?.trim() || DEFAULT_SHOPIFY_API_VERSION
  const blogGid = toBlogGid(blogIdRaw)

  // Acquire an access token (client credentials grant, or legacy static token).
  const accessToken = await getAccessToken(shopDomain, {
    clientId: tenant.shopify_client_id,
    clientSecret: tenant.shopify_client_secret,
    staticToken: tenant.shopify_access_token,
  })

  // ── 3. Resolve author (post author → tenant default → tenant name) ──────────
  // Full E-E-A-T record — Shopify's native `author` is name-only, so the bio,
  // job title and links are rendered into the body (§4) instead.
  const AUTHOR_COLS = 'name, job_title, bio, links, slug'
  let author: AuthorRecord | null = null
  if (post.author_id) {
    const { data } = await db.from('authors').select(AUTHOR_COLS).eq('id', post.author_id).single()
    author = (data as AuthorRecord | null) ?? null
  } else {
    const { data } = await db
      .from('authors')
      .select(AUTHOR_COLS)
      .eq('tenant_id', tenantId)
      .eq('is_default', true)
      .maybeSingle()
    author = (data as AuthorRecord | null) ?? null
  }
  const authorName = author?.name || tenant.name || 'Team'

  // ── 4. Build body HTML + structured data ────────────────────────────────────
  // FAQ articles get FAQPage schema; regular posts get an author bio box +
  // BlogPosting/Person schema.
  const theme = (tenant.blog_theme ?? null) as { primaryColor?: string } | null
  const bodyHtml = await toHtml(post.body_mdx ?? '', { linkColor: theme?.primaryColor })
  // published_at is only stamped in step 8, so on a first publish it's still
  // null here — fall back to now so BlogPosting always has a datePublished.
  const publishedAt = post.published_at ?? new Date().toISOString()
  const fullBody = isFaq
    ? bodyHtml + jsonLdScript(faqPageSchema(parseFaqItems(post.faq_items)))
    : bodyHtml +
      buildAuthorBioHtml(author) +
      buildAuthorJsonLd(author, tenant.name ?? authorName, post.title, post.meta_description, publishedAt)

  // Shopify SEO meta description (global.description_tag). Without this Shopify
  // auto-generates the meta description from the body — usually far too long and
  // truncated in search. Applies to both articles and pages.
  const seoMetafields = post.meta_description
    ? [
        {
          namespace: 'global',
          key: 'description_tag',
          type: 'single_line_text_field',
          value: post.meta_description,
        },
      ]
    : []

  // Forward internal links: append a Related-reading block pointing at this
  // post's published siblings (same content type, ranked by shared tags).
  const relatedRows = await getRelatedPublished(
    db,
    tenantId,
    { id: post.id, content_type: post.content_type, tags: post.tags },
    3
  )
  // Pin the cluster's money page first (hub-and-spoke), then related siblings.
  const pinnedMoney = clusterMoneyItem(tenant.content_clusters, post.cluster_id)
  const bodyWithRelated =
    fullBody +
    relatedReadingBlock([...(pinnedMoney ? [pinnedMoney] : []), ...relatedItemsFrom(relatedRows)])

  // ── 5–7. Create/update the article (FAQ → FAQ blog, else main blog) ──────────
  const base = (tenant.shopify_store_url?.trim().replace(/\/$/, '')) || `https://${shopDomain}`
  // A legacy FAQ published as a Page has a Page GID stored — treat it as new so
  // we create a fresh article (the stray page is cleaned up on next delete).
  const alreadyPushed =
    Boolean(post.shopify_article_id) && !gidIsPage(post.shopify_article_id)

  const article: Record<string, unknown> = {
    blogId: blogGid,
    title: post.title,
    handle: post.slug,
    body: bodyWithRelated,
    author: { name: authorName },
    isPublished: true,
  }
  if (post.meta_description) article.summary = post.meta_description
  if (seoMetafields.length) article.metafields = seoMetafields
  if (Array.isArray(post.tags) && post.tags.length) article.tags = post.tags
  // Shopify needs a publicly reachable image URL; skip repo-relative paths.
  if (post.hero_image_url && /^https?:\/\//i.test(post.hero_image_url)) {
    article.image = { url: post.hero_image_url, altText: post.hero_image_alt ?? post.title }
  }

  let result: { article: ArticleResult | null; userErrors: ShopifyUserError[] }
  if (alreadyPushed) {
    // articleUpdate can't move blogs; drop blogId from the update input.
    const updateInput = { ...article }
    delete updateInput.blogId
    const data = await shopifyGraphql<{ articleUpdate: typeof result }>(
      shopDomain,
      apiVersion,
      accessToken,
      UPDATE_MUTATION,
      { id: post.shopify_article_id, article: updateInput }
    )
    result = data.articleUpdate
  } else {
    const data = await shopifyGraphql<{ articleCreate: typeof result }>(
      shopDomain,
      apiVersion,
      accessToken,
      CREATE_MUTATION,
      { article }
    )
    result = data.articleCreate
  }
  if (result.userErrors?.length) {
    throw new Error(
      `[shopify] article${alreadyPushed ? 'Update' : 'Create'} failed: ` +
        result.userErrors.map((e) => `${(e.field ?? []).join('.')} ${e.message}`).join('; ')
    )
  }
  const created = result.article
  if (!created) throw new Error('[shopify] Mutation returned no article')
  const blogHandle = created.blog?.handle ?? (isFaq ? 'faqs' : 'blog')
  const articleUrl = `${base}/blogs/${blogHandle}/${created.handle}`

  // ── 8. Update the post ──────────────────────────────────────────────────────
  const now = new Date().toISOString()
  const { error: updateErr } = await db
    .from('blog_posts')
    .update({
      status: 'published',
      published_at: post.published_at ?? now,
      shopify_article_id: created.id,
      shopify_article_url: articleUrl,
      updated_at: now,
    })
    .eq('id', postId)

  if (updateErr) {
    console.error('[shopify] DB update after publish failed:', updateErr)
    throw new Error(`[shopify] DB update failed: ${updateErr.message}`)
  }

  // ── 9. Log ──────────────────────────────────────────────────────────────────
  await db.from('publish_log').insert({
    tenant_id: tenantId,
    post_id: postId,
    action: `shopify_${isFaq ? 'faq' : 'article'}_${alreadyPushed ? 'updated' : 'created'}`,
    success: true,
    response_data: {
      resource: isFaq ? 'faq' : 'article',
      resource_id: created.id,
      url: articleUrl,
    },
    attempted_at: now,
  })

  // ── 10. Retroactive internal linking ────────────────────────────────────────
  // Refresh each related sibling's Related-reading block so it now links back to
  // this newly published post. Best-effort per post — never blocks the publish.
  for (const y of relatedRows) {
    try {
      await refreshRelatedBlock(db, shopDomain, apiVersion, accessToken, tenantId, postId, tenant.content_clusters, y)
    } catch (e) {
      console.error('[shopify] retroactive related-link update failed for', y.id, e)
    }
  }

  // ── 11. IndexNow ping ───────────────────────────────────────────────────────
  // Tell Bing/IndexNow (→ ChatGPT search) about the new URL immediately.
  // Inert unless the tenant has an IndexNow key configured. Never throws.
  await pingIndexNow([articleUrl], {
    key: tenant.indexnow_key,
    keyLocation: tenant.indexnow_key_location,
  })
}

/**
 * Unpublish a post's Shopify resource (isPublished: false) — articleUpdate for a
 * blog post, pageUpdate for a FAQ page. Shopify hides it from the storefront but
 * keeps it in admin, so shopify_article_id is retained — re-publishing later
 * updates the same resource. No-op if the post was never pushed to Shopify.
 */
export async function runShopifyUnpublish(tenantId: string, postId: string): Promise<void> {
  const db = createAdminClient()

  const [{ data: post, error: postErr }, { data: tenant, error: tenantErr }] =
    await Promise.all([
      db.from('blog_posts').select('shopify_article_id, content_type').eq('id', postId).single(),
      db
        .from('tenants')
        .select(
          'shopify_shop_domain, shopify_client_id, shopify_client_secret, shopify_access_token, shopify_api_version'
        )
        .eq('id', tenantId)
        .single(),
    ])

  if (postErr || !post) throw new Error(`[shopify] Post not found: ${postId}`)
  if (tenantErr || !tenant) throw new Error(`[shopify] Tenant not found: ${tenantId}`)

  // Never pushed to Shopify → nothing to unpublish.
  if (!post.shopify_article_id) return

  const shopDomainRaw = tenant.shopify_shop_domain
  const hasCreds =
    (tenant.shopify_client_id && tenant.shopify_client_secret) || tenant.shopify_access_token
  if (!shopDomainRaw || !hasCreds) {
    throw new Error(`[shopify] Tenant ${tenantId} has incomplete Shopify config for unpublish.`)
  }

  const shopDomain = normaliseShopDomain(shopDomainRaw)
  const apiVersion = tenant.shopify_api_version?.trim() || DEFAULT_SHOPIFY_API_VERSION
  const accessToken = await getAccessToken(shopDomain, {
    clientId: tenant.shopify_client_id,
    clientSecret: tenant.shopify_client_secret,
    staticToken: tenant.shopify_access_token,
  })

  // Branch on the stored GID: legacy FAQ pages use pageUpdate, everything else
  // (incl. FAQ articles in the FAQ blog) uses articleUpdate.
  const isPage = gidIsPage(post.shopify_article_id)
  let userErrors: ShopifyUserError[]
  if (isPage) {
    const data = await shopifyGraphql<{
      pageUpdate: { page: ArticleResult | null; userErrors: ShopifyUserError[] }
    }>(shopDomain, apiVersion, accessToken, PAGE_UPDATE_MUTATION, {
      id: post.shopify_article_id,
      page: { isPublished: false },
    })
    userErrors = data.pageUpdate.userErrors
  } else {
    const data = await shopifyGraphql<{
      articleUpdate: { article: ArticleResult | null; userErrors: ShopifyUserError[] }
    }>(shopDomain, apiVersion, accessToken, UPDATE_MUTATION, {
      id: post.shopify_article_id,
      article: { isPublished: false },
    })
    userErrors = data.articleUpdate.userErrors
  }

  if (userErrors?.length) {
    throw new Error(
      `[shopify] unpublish failed: ` +
        userErrors.map((e) => `${(e.field ?? []).join('.')} ${e.message}`).join('; ')
    )
  }

  await db.from('publish_log').insert({
    tenant_id: tenantId,
    post_id: postId,
    action: `shopify_${isPage ? 'page' : 'article'}_unpublished`,
    success: true,
    response_data: { resource_id: post.shopify_article_id },
    attempted_at: new Date().toISOString(),
  })
}

/**
 * Permanently delete a post's Shopify resource — articleDelete for a blog post,
 * pageDelete for a FAQ page. Call this BEFORE deleting the NBLB row (it reads
 * shopify_article_id + content_type from it). No-op if never pushed. An
 * already-deleted resource is treated as success so it can't block deletion.
 */
export async function runShopifyDelete(tenantId: string, postId: string): Promise<void> {
  const db = createAdminClient()

  const [{ data: post, error: postErr }, { data: tenant, error: tenantErr }] =
    await Promise.all([
      db.from('blog_posts').select('shopify_article_id, content_type').eq('id', postId).single(),
      db
        .from('tenants')
        .select(
          'shopify_shop_domain, shopify_client_id, shopify_client_secret, shopify_access_token, shopify_api_version'
        )
        .eq('id', tenantId)
        .single(),
    ])

  if (postErr || !post) throw new Error(`[shopify] Post not found: ${postId}`)
  if (tenantErr || !tenant) throw new Error(`[shopify] Tenant not found: ${tenantId}`)

  // Never pushed to Shopify → nothing to delete.
  if (!post.shopify_article_id) return

  const shopDomainRaw = tenant.shopify_shop_domain
  const hasCreds =
    (tenant.shopify_client_id && tenant.shopify_client_secret) || tenant.shopify_access_token
  if (!shopDomainRaw || !hasCreds) {
    throw new Error(`[shopify] Tenant ${tenantId} has incomplete Shopify config for delete.`)
  }

  const shopDomain = normaliseShopDomain(shopDomainRaw)
  const apiVersion = tenant.shopify_api_version?.trim() || DEFAULT_SHOPIFY_API_VERSION
  const accessToken = await getAccessToken(shopDomain, {
    clientId: tenant.shopify_client_id,
    clientSecret: tenant.shopify_client_secret,
    staticToken: tenant.shopify_access_token,
  })

  // Branch on the stored GID: legacy FAQ pages use pageDelete, articles (incl.
  // FAQ articles in the FAQ blog) use articleDelete.
  const isPage = gidIsPage(post.shopify_article_id)
  let userErrors: ShopifyUserError[]
  if (isPage) {
    const data = await shopifyGraphql<{
      pageDelete: { deletedPageId: string | null; userErrors: ShopifyUserError[] }
    }>(shopDomain, apiVersion, accessToken, PAGE_DELETE_MUTATION, { id: post.shopify_article_id })
    userErrors = data.pageDelete.userErrors
  } else {
    const data = await shopifyGraphql<{
      articleDelete: { deletedArticleId: string | null; userErrors: ShopifyUserError[] }
    }>(shopDomain, apiVersion, accessToken, ARTICLE_DELETE_MUTATION, { id: post.shopify_article_id })
    userErrors = data.articleDelete.userErrors
  }

  // Treat "already gone" as success so a missing resource never blocks the delete.
  const realErrors = (userErrors ?? []).filter(
    (e) => !/not found|does(n'?| not)? exist|no longer/i.test(e.message)
  )
  if (realErrors.length) {
    throw new Error(
      `[shopify] delete failed: ` +
        realErrors.map((e) => `${(e.field ?? []).join('.')} ${e.message}`).join('; ')
    )
  }
}
