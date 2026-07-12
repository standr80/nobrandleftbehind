import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nobrandleftbehind.com'

// Marketing-site robots for the main domain. (The blog subdomain has its own
// under app/blog/robots.txt.) Keep the app/auth areas out of the index.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard',
          '/settings',
          '/setup',
          '/admin',
          '/author',
          '/api',
          '/sign-in',
          '/sign-up',
          '/invite',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
