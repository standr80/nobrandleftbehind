import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getTenantByBlogHost } from '@/lib/blog/getTenantByBlogHost'
import { getSidebarData } from '@/lib/blog/getSidebarData'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const host = (await headers()).get('x-blog-host') ?? ''
  const tenant = host ? await getTenantByBlogHost(host) : null
  if (!tenant) return {}
  return {
    title: `All topics | ${tenant.name} Blog`,
    alternates: { canonical: `https://${host}/topics` },
  }
}

export default async function TopicsPage() {
  const headersList = await headers()
  const blogHost = headersList.get('x-blog-host')
  if (!blogHost) notFound()

  const tenant = await getTenantByBlogHost(blogHost)
  if (!tenant) notFound()

  const sidebar = await getSidebarData(tenant.id)
  const theme = tenant.blog_theme
  const blogUrl = `https://${blogHost}`

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '3rem 1.5rem' }}>
      <a href={blogUrl} style={{ fontSize: '0.875rem', color: theme.primaryColor, fontWeight: 500, textDecoration: 'none' }}>
        ← All articles
      </a>

      <h1 style={{
        fontFamily: theme.headingFont,
        fontSize: 'clamp(1.5rem, 4vw, 2.25rem)',
        fontWeight: 800,
        marginTop: '1rem',
        marginBottom: '0.5rem',
        color: theme.textColor,
      }}>
        All topics
      </h1>
      <p style={{ fontSize: '0.9rem', opacity: 0.5, marginBottom: '2.5rem' }}>
        {sidebar.allTags.length} topic{sidebar.allTags.length !== 1 ? 's' : ''} across all articles
      </p>

      {sidebar.allTags.length === 0 ? (
        <p style={{ opacity: 0.5 }}>No topics yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {sidebar.allTags.map(({ tag, count }) => (
            <a
              key={tag}
              href={`${blogUrl}/tags/${encodeURIComponent(tag)}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.875rem 1.25rem',
                borderRadius: '0.75rem',
                border: '1px solid rgba(0,0,0,0.08)',
                backgroundColor: theme.backgroundColor,
                color: theme.textColor,
                textDecoration: 'none',
                transition: 'box-shadow 0.15s',
              }}
            >
              <span style={{ fontFamily: theme.headingFont, fontWeight: 600, fontSize: '0.95rem' }}>
                {tag}
              </span>
              <span style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: theme.primaryColor,
                backgroundColor: `${theme.primaryColor}15`,
                padding: '0.25rem 0.75rem',
                borderRadius: '999px',
              }}>
                {count} article{count !== 1 ? 's' : ''}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
