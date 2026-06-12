/**
 * Tenant sites — unified competitor / reference site list.
 *
 * Single source of truth (migration 021) replacing the old split between
 * tenants.reference_urls and scout_config.competitor_urls.
 */

import { createAdminClient } from '@/lib/supabase/admin'

export interface TenantSite {
  id: string
  tenant_id: string
  url: string
  is_competitor: boolean
  is_reference: boolean
  label: string | null
  created_at: string | null
  updated_at: string | null
}

export interface SiteLimits {
  maxCompetitorSites: number
  maxReferenceSites: number
}

/** Lowercase, strip scheme and trailing slash — canonical storage form. */
export function normalizeSiteUrl(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '')
    .toLowerCase()
}

/** Storage form → fetchable URL. */
export function siteUrlToHttps(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

export async function getTenantSites(tenantId: string): Promise<TenantSite[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('tenant_sites')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(`Failed to load tenant sites: ${error.message}`)
  return (data ?? []) as TenantSite[]
}

export async function getSiteLimits(tenantId: string): Promise<SiteLimits> {
  const db = createAdminClient()
  const { data } = await db
    .from('tenants')
    .select('max_competitor_sites, max_reference_sites')
    .eq('id', tenantId)
    .single()
  const row = data as { max_competitor_sites?: number; max_reference_sites?: number } | null
  return {
    maxCompetitorSites: row?.max_competitor_sites ?? 3,
    maxReferenceSites: row?.max_reference_sites ?? 3,
  }
}

/** Competitor URLs (https://-prefixed) for Scout pipelines. */
export async function getCompetitorUrls(tenantId: string): Promise<string[]> {
  const sites = await getTenantSites(tenantId)
  return sites.filter((s) => s.is_competitor).map((s) => siteUrlToHttps(s.url))
}

/** Reference URLs (storage form, no scheme) for Clem crawling. */
export async function getReferenceUrls(tenantId: string): Promise<string[]> {
  const sites = await getTenantSites(tenantId)
  return sites.filter((s) => s.is_reference).map((s) => s.url)
}
