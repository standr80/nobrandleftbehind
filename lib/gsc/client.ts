// Google Search Console client — service-account auth, no SDK dependency.
//
// Auth model: ONE shared service account (env GSC_SERVICE_ACCOUNT_KEY holds
// the full JSON key). Its email is added as a (Restricted) user on each
// brand's Search Console property. Per-tenant OAuth for third-party clients
// comes later (the scout_config token stub columns anticipate it).
//
// The JWT-bearer flow is implemented with node:crypto (RS256) to avoid
// pulling in googleapis — it's ~30 lines.

import { createSign } from 'crypto'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'

interface ServiceAccountKey {
  client_email: string
  private_key: string
}

let cachedToken: { token: string; expiresAt: number } | null = null

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

function loadKey(): ServiceAccountKey {
  const raw = process.env.GSC_SERVICE_ACCOUNT_KEY
  if (!raw) throw new Error('GSC_SERVICE_ACCOUNT_KEY env var is not set')
  try {
    const parsed = JSON.parse(raw) as ServiceAccountKey
    if (!parsed.client_email || !parsed.private_key) throw new Error('missing fields')
    return parsed
  } catch {
    throw new Error('GSC_SERVICE_ACCOUNT_KEY is not valid service-account JSON')
  }
}

export async function getGscAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.token

  const key = loadKey()
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(
    JSON.stringify({
      iss: key.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  )
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${claims}`)
  const signature = signer.sign(key.private_key).toString('base64url')
  const assertion = `${header}.${claims}.${signature}`

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  if (!res.ok) {
    throw new Error(`GSC token exchange failed: ${res.status} ${await res.text().catch(() => '')}`)
  }
  const data = (await res.json()) as { access_token: string; expires_in: number }
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
  return data.access_token
}

export interface GscRow {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

/** Run a Search Analytics query against a property (sc-domain:example.com
 *  or https://www.example.com/). */
export async function searchAnalyticsQuery(
  propertyId: string,
  body: {
    startDate: string
    endDate: string
    dimensions: string[]
    rowLimit?: number
    startRow?: number
  },
): Promise<GscRow[]> {
  const token = await getGscAccessToken()
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(propertyId)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ rowLimit: 25000, ...body }),
    },
  )
  if (!res.ok) {
    throw new Error(`GSC query failed (${propertyId}): ${res.status} ${await res.text().catch(() => '')}`)
  }
  const data = (await res.json()) as { rows?: GscRow[] }
  return data.rows ?? []
}
