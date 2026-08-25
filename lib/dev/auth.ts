/**
 * Password gate for the /dev R&D area.
 *
 * Deliberately has no user table and no session store. There is one shared
 * password in `DEV_PASSWORD`; the cookie holds a hash derived from it, so
 * changing the env var in Vercel immediately invalidates every issued cookie
 * (i.e. rotating the password signs everyone out, which is the point).
 *
 * Uses Web Crypto rather than node:crypto so it runs unchanged in middleware
 * on the Edge runtime.
 */

export const DEV_COOKIE = 'nblb_dev'

/** 30 days. Long enough to be unobtrusive, short enough to expire stale shares. */
export const DEV_COOKIE_MAX_AGE = 60 * 60 * 24 * 30

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** The cookie value for a given password. Salted so it isn't a bare password hash. */
export async function devToken(password: string): Promise<string> {
  return sha256Hex(`nblb-dev-v1:${password}`)
}

/** Length-independent comparison — avoids leaking the token via timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** True when the supplied password matches DEV_PASSWORD. */
export async function isValidPassword(password: string): Promise<boolean> {
  const expected = process.env.DEV_PASSWORD
  if (!expected) return false
  return safeEqual(await devToken(password), await devToken(expected))
}

/** True when a request cookie is a currently-valid token. */
export async function isValidDevToken(token: string | undefined): Promise<boolean> {
  const expected = process.env.DEV_PASSWORD
  if (!expected || !token) return false
  return safeEqual(token, await devToken(expected))
}

/**
 * Only allow post-login redirects back into the dev area, so a crafted
 * ?next= can't turn the login form into an open redirect.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next) return '/dev'
  if (!next.startsWith('/dev')) return '/dev'
  if (next.startsWith('//')) return '/dev'
  return next
}
