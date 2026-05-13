import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getTenantByBlogHost, POSTS_PER_PAGE } from '@/lib/blog/getTenantByBlogHost'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ tag: string }>
  searchParams: Promise<{ page?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params
  const host = (await headers()).get('x-blog-host') ?? ''
  const tenant = host ? await getTenantByBlogHost(host) : null
  if (!tenant) return {}
  const decoded = decodeURIComponent(tag)
  return {
    title: `${decoded} | ${tenant.name} Blog`,
    alternates: { canonical: `https://${host}/tags/${tag}` },
  }
}

export default async function TagPage({ params, searchParams }: Props) {
  const { tag } = await params
  const headersList = await headers()
  const blogHost = headersList.get('x-blog-host')
  if (!blogHost) notFound()

  const tenant = await getTenantByBlogHost(blogHost)
  if (!tenant) notFound()

  const decodedTag = decodeURIComponent(tag)
  const resolvedSearch = await searchParams
  const page = Math.max(1, parseInt(resolvedSearch.page ?? '1', 10))
  const from = (page - 1) * POSTS_PER_PAGE

  const db = createAdminClient()

  const { data: posts, count } = await db
    .from('blog_posts')
    .select('id, title, slug, excerpt, published_at, tags, hero_image_url, hero_image_alt', { count: 'exact' })
    .eq('tenant_id', tenant.id)
    .eq('status', 'published')
    .contains('tags', [decodedTag])
    .order('published_at', { ascending: false })
    .range(from, from + POSTS_PER_PAGE - 1)

  const totalPages = Math.ceil((count ?? 0) / POSTS_PER_PAGE)
  const theme = tenant.blog_theme
  const blogUrl = `https://${blogHost}`

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '3rem 1.5rem' }}>

      <div style={{ marginBottom: '3rem' }}>
        <a href={blogUrl} style={{ fontSize: '0.875rem', color: theme.primaryColor, fontWeight: 500 }}>
          ← All articles
        </a>
        <h1 style={{
          fontFamily: theme.headingFont,
          fontSize: 'clamp(1.5rem, 4vw, 2.25rem)',
          fontWeight: 800,
          marginTop: '1rem',
          color: theme.textColor,
        }}>
          {decodedTag}
        </h1>
        <p style={{ opacity: 0.5, fontSize: '0.9rem' }}>
          {count ?? 0} article{count !== 1 ? 's' : ''}
        </p>
      </div>

      {(posts ?? []).length === 0 ? (
        <p style={{ opacity: 0.5 }}>No articles found for this tag.</p>
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
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: '1rem',
                overflow: 'hidden',
                backgroundColor: theme.backgroundColor,
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
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
                <h2 style={{
                  fontFamily: theme.headingFont,
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  marginBottom: '0.5rem',
                  color: theme.textColor,
                  lineHeight: 1.35,
                  flex: 1,
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

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '3rem' }}>
          {page > 1 && (
            <a href={`${blogUrl}/tags/${tag}?page=${page - 1}`} style={{ padding: '0.6rem 1.25rem', borderRadius: '0.5rem', border: `1px solid ${theme.primaryColor}`, color: theme.primaryColor, fontSize: '0.875rem' }}>
              ← Previous
            </a>
          )}
          <span style={{ padding: '0.6rem 1rem', fontSize: '0.875rem', opacity: 0.5 }}>
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <a href={`${blogUrl}/tags/${tag}?page=${page + 1}`} style={{ padding: '0.6rem 1.25rem', borderRadius: '0.5rem', border: `1px solid ${theme.primaryColor}`, color: theme.primaryColor, fontSize: '0.875rem' }}>
              Next →
            </a>
          )}
        </div>
      )}
    </div>
  )
}
