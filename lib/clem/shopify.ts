import { createAdminClient } from '@/lib/supabase/admin'
import { toHtml } from '@/lib/mdx/toHtml'

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

export async function runShopifyPublish(tenantId: string, postId: string): Promise<void> {
  const db = createAdminClient()

  // ── 1. Load post + tenant ──────────────────────────────────────────────────
  const [{ data: post, error: postErr }, { data: tenant, error: tenantErr }] =
    await Promise.all([
      db.from('blog_posts').select('*').eq('id', postId).single(),
      db
        .from('tenants')
        .select(
          'cms_type, name, blog_theme, shopify_shop_domain, shopify_client_id, shopify_client_secret, shopify_access_token, shopify_blog_id, shopify_api_version, shopify_store_url'
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
  const shopDomainRaw = tenant.shopify_shop_domain
  const blogIdRaw = tenant.shopify_blog_id
  const hasCreds =
    (tenant.shopify_client_id && tenant.shopify_client_secret) || tenant.shopify_access_token
  if (!shopDomainRaw || !hasCreds || !blogIdRaw) {
    throw new Error(
      `[shopify] Tenant ${tenantId} has incomplete Shopify config. Set shopify_shop_domain, ` +
        `shopify_blog_id and either shopify_client_id + shopify_client_secret or shopify_access_token.`
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

  // ── 4. Build article body HTML (+ author bio box + Person JSON-LD) ──────────
  const theme = (tenant.blog_theme ?? null) as { primaryColor?: string } | null
  const bodyHtml = await toHtml(post.body_mdx ?? '', { linkColor: theme?.primaryColor })
  const fullBody =
    bodyHtml +
    buildAuthorBioHtml(author) +
    buildAuthorJsonLd(author, tenant.name ?? authorName, post.title, post.meta_description, post.published_at)

  // ── 5. Assemble the article input ──────────────────────────────────────────
  const article: Record<string, unknown> = {
    blogId: blogGid,
    title: post.title,
    handle: post.slug,
    body: fullBody,
    author: { name: authorName },
    isPublished: true,
  }
  if (post.meta_description) article.summary = post.meta_description
  if (Array.isArray(post.tags) && post.tags.length) article.tags = post.tags
  // Shopify needs a publicly reachable image URL; skip repo-relative paths.
  if (post.hero_image_url && /^https?:\/\//i.test(post.hero_image_url)) {
    article.image = {
      url: post.hero_image_url,
      altText: post.hero_image_alt ?? post.title,
    }
  }

  // ── 6. Create or update ─────────────────────────────────────────────────────
  const alreadyPushed = Boolean(post.shopify_article_id)
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

  // ── 7. Build the public URL ─────────────────────────────────────────────────
  const base = (tenant.shopify_store_url?.trim().replace(/\/$/, '')) || `https://${shopDomain}`
  const blogHandle = created.blog?.handle ?? 'blog'
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
    action: alreadyPushed ? 'shopify_article_updated' : 'shopify_article_created',
    success: true,
    response_data: {
      article_id: created.id,
      article_url: articleUrl,
      blog_handle: blogHandle,
    },
    attempted_at: now,
  })
}
