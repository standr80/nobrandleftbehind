import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getTenantByBlogHost, POSTS_PER_PAGE } from '@/lib/blog/getTenantByBlogHost'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Metadata } from 'next'

interface Props {
  searchParams: Promise<{ page?: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  const host = (await headers()).get('x-blog-host') ?? ''
  const tenant = host ? await getTenantByBlogHost(host) : null
  if (!tenant) return {}
  return {
    title: `${tenant.name} Blog`,
    description: `Latest articles from ${tenant.name}`,
    alternates: { canonical: `https://${host}` },
  }
}

export default async function BlogListingPage({ searchParams }: Props) {
  const headersList = await headers()
  const blogHost = headersList.get('x-blog-host')
  if (!blogHost) notFound()

  const tenant = await getTenantByBlogHost(blogHost)
  if (!tenant) notFound()

  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const from = (page - 1) * POSTS_PER_PAGE

  const db = createAdminClient()

  const { data: posts, count } = await db
    .from('blog_posts')
    .select('id, title, slug, excerpt, published_at, tags, hero_image_url, hero_image_alt', { count: 'exact' })
    .eq('tenant_id', tenant.id)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .range(from, from + POSTS_PER_PAGE - 1)

  const totalPages = Math.ceil((count ?? 0) / POSTS_PER_PAGE)
  const theme = tenant.blog_theme
  const blogUrl = `https://${blogHost}`

  // Collect all unique tags for the tag cloud
  const allTags = Array.from(
    new Set((posts ?? []).flatMap((p) => p.tags ?? []))
  ).sort()

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '3rem 1.5rem' }}>

      {/* Page heading */}
      <div style={{ marginBottom: '3rem' }}>
        <h1 style={{
          fontFamily: theme.headingFont,
          fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
          fontWeight: 800,
          marginBottom: '0.5rem',
          color: theme.textColor,
        }}>
          Latest articles
        </h1>
        {allTags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem' }}>
            {allTags.map((tag) => (
              <a
                key={tag}
                href={`${blogUrl}/tags/${encodeURIComponent(tag)}`}
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  padding: '0.25rem 0.75rem',
                  borderRadius: '999px',
                  border: `1px solid ${theme.primaryColor}`,
                  color: theme.primaryColor,
                  backgroundColor: 'transparent',
                  transition: 'background 0.15s',
                }}
              >
                {tag}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Post grid */}
      {(posts ?? []).length === 0 ? (
        <p style={{ opacity: 0.5 }}>No articles published yet.</p>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))',
          gap: '2rem',
        }}>
          {(posts ?? []).map((post) => (
            <a
              key={post.id}
              href={`${blogUrl}/${post.slug}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                border: `1px solid rgba(0,0,0,0.08)`,
                borderRadius: '1rem',
                overflow: 'hidden',
                backgroundColor: theme.backgroundColor,
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                transition: 'box-shadow 0.2s, transform 0.2s',
                color: 'inherit',
                textDecoration: 'none',
              }}
            >
              {post.hero_image_url && (
                <div style={{ aspectRatio: '16/9', overflow: 'hidden', flexShrink: 0 }}>
                  <img
                    src={post.hero_image_url}
                    alt={post.hero_image_alt ?? post.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              )}
              <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                {post.tags && post.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                    {post.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: theme.primaryColor,
                          backgroundColor: `rgba(${post.tags ? '79,70,229' : '0,0,0'}, 0.07)`,
                          padding: '0.2rem 0.5rem',
                          borderRadius: '0.25rem',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <h2 style={{
                  fontFamily: theme.headingFont,
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  marginBottom: '0.5rem',
                  color: theme.textColor,
                  flex: 1,
                  lineHeight: 1.35,
                }}>
                  {post.title}
                </h2>
                {post.excerpt && (
                  <p style={{
                    fontSize: '0.875rem',
                    opacity: 0.7,
                    lineHeight: 1.6,
                    marginBottom: '1rem',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {post.excerpt}
                  </p>
                )}
                <time style={{ fontSize: '0.8rem', opacity: 0.45 }}>
                  {post.published_at
                    ? new Date(post.published_at).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })
                    : ''}
                </time>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '0.75rem',
          marginTop: '3rem',
        }}>
          {page > 1 && (
            <a
              href={`${blogUrl}?page=${page - 1}`}
              style={{
                padding: '0.6rem 1.25rem',
                borderRadius: '0.5rem',
                border: `1px solid ${theme.primaryColor}`,
                color: theme.primaryColor,
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              ← Previous
            </a>
          )}
          <span style={{ padding: '0.6rem 1rem', fontSize: '0.875rem', opacity: 0.5 }}>
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <a
              href={`${blogUrl}?page=${page + 1}`}
              style={{
                padding: '0.6rem 1.25rem',
                borderRadius: '0.5rem',
                border: `1px solid ${theme.primaryColor}`,
                color: theme.primaryColor,
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              Next →
            </a>
          )}
        </div>
      )}
    </div>
  )
}
