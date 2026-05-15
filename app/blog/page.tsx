import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getTenantByBlogHost, POSTS_PER_PAGE } from '@/lib/blog/getTenantByBlogHost'
import { getSidebarData } from '@/lib/blog/getSidebarData'
import { createAdminClient } from '@/lib/supabase/admin'
import type { BlogTheme } from '@/lib/blog/types'
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

// ── Shared UI helpers ────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ── Page ─────────────────────────────────────────────────────────────────────

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

  const [{ data: posts, count }, sidebar] = await Promise.all([
    db.from('blog_posts')
      .select('id, title, slug, excerpt, published_at, tags, hero_image_url, hero_image_alt', { count: 'exact' })
      .eq('tenant_id', tenant.id)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .range(from, from + POSTS_PER_PAGE - 1),
    getSidebarData(tenant.id),
  ])

  const allPosts = posts ?? []
  const totalPages = Math.ceil((count ?? 0) / POSTS_PER_PAGE)
  const theme = tenant.blog_theme
  const blogUrl = `https://${blogHost}`

  // Page 1: first post is the hero feature, rest go to grid
  const featuredPost = page === 1 && allPosts.length > 0 ? allPosts[0] : null
  const gridPosts = page === 1 ? allPosts.slice(1) : allPosts

  const responsiveCss = `
    .blog-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; }
    .blog-layout { display: grid; grid-template-columns: 1fr 280px; gap: 3rem; margin-top: 2.5rem; align-items: start; }
    .blog-featured { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border-radius: 1rem; overflow: hidden; text-decoration: none; color: inherit; border: 1px solid rgba(0,0,0,0.08); box-shadow: 0 2px 8px rgba(0,0,0,0.07); }
    .blog-sidebar-link { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.625rem; border-radius: 0.5rem; text-decoration: none; font-size: 0.875rem; transition: background 0.15s; }
    .blog-sidebar-link:hover { background-color: rgba(0,0,0,0.05); text-decoration: none; }
    @media (max-width: 768px) {
      .blog-grid { grid-template-columns: 1fr; }
      .blog-layout { grid-template-columns: 1fr; }
      .blog-featured { grid-template-columns: 1fr; }
    }
  `

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '3rem 1.5rem' }}>
      <style dangerouslySetInnerHTML={{ __html: responsiveCss }} />

      {/* Page heading */}
      <h1 style={{
        fontFamily: theme.headingFont,
        fontSize: 'clamp(1.5rem, 3vw, 2rem)',
        fontWeight: 800,
        marginBottom: '2rem',
        color: theme.textColor,
      }}>
        {page > 1 ? `Latest articles — page ${page}` : 'Latest articles'}
      </h1>

      {/* ── Featured post (page 1 only) ── */}
      {featuredPost && (
        <a href={`${blogUrl}/${featuredPost.slug}`} className="blog-featured">
          {/* Image side */}
          {featuredPost.hero_image_url ? (
            <div style={{ position: 'relative', minHeight: '300px', overflow: 'hidden' }}>
              <img
                src={featuredPost.hero_image_url}
                alt={featuredPost.hero_image_alt ?? featuredPost.title}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          ) : (
            <div style={{ backgroundColor: `${theme.primaryColor}18`, minHeight: '300px' }} />
          )}
          {/* Text side */}
          <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', backgroundColor: theme.backgroundColor }}>
            <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <span style={{
                fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.1em', color: theme.primaryColor,
              }}>
                Featured
              </span>
              {(featuredPost.tags ?? []).slice(0, 2).map(tag => (
                <span key={tag} style={{
                  fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase',
                  letterSpacing: '0.06em', color: theme.primaryColor,
                  border: `1px solid ${theme.primaryColor}`,
                  padding: '0.2rem 0.55rem', borderRadius: '999px',
                }}>
                  {tag}
                </span>
              ))}
            </div>
            <h2 style={{
              fontFamily: theme.headingFont,
              fontSize: 'clamp(1.2rem, 2.5vw, 1.65rem)',
              fontWeight: 800, lineHeight: 1.25,
              marginBottom: '0.75rem', color: theme.textColor,
            }}>
              {featuredPost.title}
            </h2>
            {featuredPost.excerpt && (
              <p style={{ fontSize: '0.9rem', opacity: 0.7, lineHeight: 1.65, marginBottom: '1.25rem' }}>
                {featuredPost.excerpt}
              </p>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
              <time style={{ fontSize: '0.8rem', opacity: 0.45 }}>{formatDate(featuredPost.published_at)}</time>
              <span style={{ fontSize: '0.85rem', color: theme.primaryColor, fontWeight: 600 }}>Read article →</span>
            </div>
          </div>
        </a>
      )}

      {/* ── Main layout: grid + sidebar ── */}
      <div className="blog-layout">

        {/* Post grid */}
        <div>
          {gridPosts.length === 0 && !featuredPost ? (
            <p style={{ opacity: 0.5 }}>No articles published yet.</p>
          ) : gridPosts.length > 0 ? (
            <div className="blog-grid">
              {gridPosts.map((post) => (
                <PostCard key={post.id} post={post} blogUrl={blogUrl} theme={theme} />
              ))}
            </div>
          ) : null}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', marginTop: '3rem' }}>
              {page > 1 && (
                <a href={`${blogUrl}?page=${page - 1}`} style={{
                  padding: '0.6rem 1.25rem', borderRadius: '0.5rem',
                  border: `1px solid ${theme.primaryColor}`,
                  color: theme.primaryColor, fontSize: '0.875rem',
                  fontWeight: 500, textDecoration: 'none',
                }}>
                  ← Previous
                </a>
              )}
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <a
                  key={p}
                  href={`${blogUrl}?page=${p}`}
                  style={{
                    padding: '0.5rem 0.875rem', borderRadius: '0.5rem', fontSize: '0.875rem',
                    fontWeight: p === page ? 700 : 400,
                    color: p === page ? '#fff' : theme.primaryColor,
                    backgroundColor: p === page ? theme.primaryColor : 'transparent',
                    border: `1px solid ${theme.primaryColor}`,
                    textDecoration: 'none',
                  }}
                >
                  {p}
                </a>
              ))}
              {page < totalPages && (
                <a href={`${blogUrl}?page=${page + 1}`} style={{
                  padding: '0.6rem 1.25rem', borderRadius: '0.5rem',
                  border: `1px solid ${theme.primaryColor}`,
                  color: theme.primaryColor, fontSize: '0.875rem',
                  fontWeight: 500, textDecoration: 'none',
                }}>
                  Next →
                </a>
              )}
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <BlogSidebar sidebar={sidebar} theme={theme} blogUrl={blogUrl} />
      </div>
    </div>
  )
}

// ── Post card ─────────────────────────────────────────────────────────────────

function PostCard({ post, blogUrl, theme }: {
  post: { id: string; title: string; slug: string; excerpt: string | null; published_at: string | null; tags: string[] | null; hero_image_url: string | null; hero_image_alt: string | null }
  blogUrl: string
  theme: BlogTheme
}) {
  return (
    <a
      href={`${blogUrl}/${post.slug}`}
      style={{
        display: 'flex', flexDirection: 'column',
        border: '1px solid rgba(0,0,0,0.08)', borderRadius: '0.875rem',
        overflow: 'hidden', backgroundColor: theme.backgroundColor,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        color: 'inherit', textDecoration: 'none',
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
      <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {(post.tags ?? []).length > 0 && (
          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
            {(post.tags ?? []).slice(0, 2).map(tag => (
              <span key={tag} style={{
                fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.05em', color: theme.primaryColor,
                backgroundColor: `${theme.primaryColor}12`,
                padding: '0.2rem 0.5rem', borderRadius: '0.2rem',
              }}>
                {tag}
              </span>
            ))}
          </div>
        )}
        <h2 style={{
          fontFamily: theme.headingFont, fontSize: '1rem', fontWeight: 700,
          lineHeight: 1.35, marginBottom: '0.5rem', color: theme.textColor, flex: 1,
        }}>
          {post.title}
        </h2>
        {post.excerpt && (
          <p style={{
            fontSize: '0.825rem', opacity: 0.7, lineHeight: 1.6, marginBottom: '0.875rem',
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {post.excerpt}
          </p>
        )}
        <time style={{ fontSize: '0.75rem', opacity: 0.4 }}>
          {post.published_at ? new Date(post.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
        </time>
      </div>
    </a>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export function BlogSidebar({ sidebar, theme, blogUrl }: {
  sidebar: Awaited<ReturnType<typeof getSidebarData>>
  theme: BlogTheme
  blogUrl: string
}) {
  return (
    <aside>
      <div style={{
        border: '1px solid rgba(0,0,0,0.08)', borderRadius: '0.875rem',
        padding: '1.5rem', backgroundColor: theme.backgroundColor,
        position: 'sticky', top: '80px',
      }}>
        <h3 style={{
          fontFamily: theme.headingFont, fontSize: '0.8rem', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.08em',
          opacity: 0.5, marginBottom: '1rem',
        }}>
          Browse by topic
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {sidebar.topTags.map(({ tag, count }) => (
            <a
              key={tag}
              href={`${blogUrl}/tags/${encodeURIComponent(tag)}`}
              className="blog-sidebar-link"
              style={{ color: theme.textColor }}
            >
              <span>{tag}</span>
              <span style={{
                fontSize: '0.7rem', fontWeight: 600, color: theme.primaryColor,
                backgroundColor: `${theme.primaryColor}15`,
                padding: '0.15rem 0.5rem', borderRadius: '999px',
              }}>
                {count}
              </span>
            </a>
          ))}
        </div>
        {sidebar.hasMoreTags && (
          <a
            href={`${blogUrl}/topics`}
            style={{
              display: 'block', marginTop: '1rem', fontSize: '0.8rem',
              color: theme.primaryColor, fontWeight: 600, textDecoration: 'none',
              paddingTop: '0.75rem', borderTop: '1px solid rgba(0,0,0,0.07)',
            }}
          >
            All topics →
          </a>
        )}
        {sidebar.topTags.length === 0 && (
          <p style={{ fontSize: '0.8rem', opacity: 0.4 }}>No topics yet.</p>
        )}
      </div>
    </aside>
  )
}
