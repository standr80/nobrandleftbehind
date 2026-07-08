// IndexNow ping — notifies Bing/IndexNow (and therefore ChatGPT search, which
// runs on Bing) the moment a URL is published, instead of waiting for a crawl.
//
// Shopify can't host the required key file at the site root, so the key file is
// uploaded via Settings → Files and its CDN URL is passed as `keyLocation`.
// See docs/shopify-publishing.md for the one-time setup.
//
// Best-effort by design: never throws, returns false on any problem so a
// notification failure can never affect publishing.

export async function pingIndexNow(
  urls: string[],
  opts: { key?: string | null; keyLocation?: string | null }
): Promise<boolean> {
  const key = opts.key?.trim()
  const list = urls.filter(Boolean)
  if (!key || !list.length) return false

  let host: string
  try {
    host = new URL(list[0]).host
  } catch {
    console.warn('[indexnow] first URL is not absolute — skipping', list[0])
    return false
  }

  const body: Record<string, unknown> = { host, key, urlList: list }
  if (opts.keyLocation?.trim()) body.keyLocation = opts.keyLocation.trim()

  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
    })
    // 200 = accepted, 202 = accepted (pending key validation).
    if (res.status !== 200 && res.status !== 202) {
      console.error('[indexnow] ping failed', res.status, await res.text().catch(() => ''))
      return false
    }
    return true
  } catch (e) {
    console.error('[indexnow] ping error', e)
    return false
  }
}
