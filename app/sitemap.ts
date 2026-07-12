import type { MetadataRoute } from 'next'
import { agents } from '@/lib/marketing/agents'

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nobrandleftbehind.com'

// Marketing-site sitemap for the main domain. Extend as new marketing pages
// (pricing, faq, etc.) are added.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const routes: { path: string; priority: number }[] = [
    { path: '', priority: 1 },
    { path: '/academy', priority: 0.7 },
    ...agents.map((a) => ({ path: `/agents/${a.id}`, priority: 0.8 })),
  ]
  return routes.map(({ path, priority }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority,
  }))
}
