import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getTenantByBlogHost, POSTS_PER_PAGE } from '@/lib/blog/getTenantByBlogHost'
import { getSidebarData } from '@/lib/blog/getSidebarData'
import { tagToSlug, slugToTag } from '@/lib/blog/tagUtils'
import { BlogSidebar } from '@/app/blog/page'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ tag: string }>
  searchParams: Promise<{ page?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag: tagSlug } = await params
  const host = (await headers()).get('x-blog-host') ?? ''
  const tenant = host ? await getTenantByBlogHost(host) : null
  if (!tenant) return {}

  const db = createAdminClient()
  const { data } = await db.from('blog_posts').select('tags').eq('tenant_id', tenant.id).eq('status', 'published')
  const allTags = [...new Set((data ?? []).flatMap((p) => p.tags ?? []))]
  const originalTag = slugToTag(tagSlug, allTags)
  if (!originalTag) return {}

  return {
    title: `${originalTag} | ${tenant.name} Blog`,
    alternates: { canonical: `https://${host}/tags/${tagToSlug(originalTag)}` },
    openGraph: { siteName: `${tenant.name} Blog` },
  }
}

export default async function TagPage({ params, searchParams }: Props) {
  const { tag: tagSlug } = await params
  const headersList = await headers()
  const blogHost = headersList.get('x-blog-host')
  if (!blogHost) notFound()

  const tenant = await getTenantByBlogHost(blogHost)
  if (!tenant) notFound()

  const resolvedSearch = await searchParams
  const page = Math.max(1, parseInt(resolvedSearch.page ?? '1', 10))
  const from = (page - 1) * POSTS_PER_PAGE

  const db = createAdminClient()

  // Resolve slug → original stored tag value
  const { data: allTagData } = await db
    .from('blog_posts').select('tags')
    .eq('tenant_id', tenant.id).eq('status', 'published')
  const allTags = [...new Set((allTagData ?? []).flatMap((p) => p.tags ?? []))]
  const originalTag = slugToTag(tagSlug, allTags)
  if (!originalTag) notFound()

  const [{ data: posts, count }, sidebar] = await Promise.all([
    db.from('blog_posts')
      .select('id, title, slug, excerpt, published_at, tags, hero_image_url, hero_image_alt', { count: 'exact' })
      .eq('tenant_id', tenant.id)
      .eq('status', 'published')
      .contains('tags', [originalTag])
      .order('published_at', { ascending: false })
      .range(from, from + POSTS_PER_PAGE - 1),
    getSidebarData(tenant.id),
  ])

  const totalPages = Math.ceil((count ?? 0) / POSTS_PER_PAGE)
  const theme = tenant.blog_theme
  const blogUrl = `https://${blogHost}`

  const responsiveCss = `
    .blog-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; }
    .blog-layout { display: grid; grid-template-columns: 1fr 280px; gap: 3rem; margin-top: 2rem; align-items: start; }
    .blog-sidebar-link { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.625rem; border-radius: 0.5rem; text-decoration: none; font-size: 0.875rem; transition: background 0.15s; }
    .blog-sidebar-link:hover { background-color: rgba(0,0,0,0.05); text-decoration: none; }
    @media (max-width: 768px) {
      .blog-grid { grid-template-columns: 1fr; }
      .blog-layout { grid-template-columns: 1fr; }
    }
  `

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '3rem 1.5rem' }}>
      <style dangerouslySetInnerHTML={{ __html: responsiveCss }} />

      <a href={blogUrl} style={{ fontSize: '0.875rem', color: theme.primaryColor, fontWeight: 500, textDecoration: 'none' }}>
        ← All articles
      </a>

      <div style={{ marginTop: '1rem', marginBottom: '2rem' }}>
        <h1 style={{
          fontFamily: theme.headingFont, fontSize: 'clamp(1.5rem, 4vw, 2.25rem)',
          fontWeight: 800, color: theme.textColor, marginBottom: '0.375rem',
        }}>
          {originalTag}
        </h1>
        <p style={{ fontSize: '0.875rem', opacity: 0.5 }}>
          {count ?? 0} article{count !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="blog-layout">
        <div>
          {(posts ?? []).length === 0 ? (
            <p style={{ opacity: 0.5 }}>No articles found for this topic.</p>
          ) : (
            <div className="blog-grid">
              {(posts ?? []).map((post) => (
                <a key={post.id} href={`${blogUrl}/${post.slug}`} style={{
                  display: 'flex', flexDirection: 'column',
                  border: '1px solid rgba(0,0,0,0.08)', borderRadius: '0.875rem',
                  overflow: 'hidden', backgroundColor: theme.backgroundColor,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)', color: 'inherit', textDecoration: 'none',
                }}>
                  {post.hero_image_url && (
                    <div style={{ aspectRatio: '16/9', overflow: 'hidden', flexShrink: 0 }}>
                      <img src={post.hero_image_url} alt={post.hero_image_alt ?? post.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                  <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {(post.tags ?? []).filter(t => t !== originalTag).length > 0 && (
                      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                        {(post.tags ?? []).filter(t => t !== originalTag).slice(0, 2).map(t => (
                          <a key={t} href={`${blogUrl}/tags/${tagToSlug(t)}`} style={{
                            fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase',
                            letterSpacing: '0.05em', color: theme.primaryColor,
                            backgroundColor: `${theme.primaryColor}12`,
                            padding: '0.2rem 0.5rem', borderRadius: '0.2rem', textDecoration: 'none',
                          }}>
                            {t}
                          </a>
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
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', marginTop: '3rem' }}>
              {page > 1 && (
                <a href={`${blogUrl}/tags/${tagToSlug(originalTag)}?page=${page - 1}`} style={{ padding: '0.6rem 1.25rem', borderRadius: '0.5rem', border: `1px solid ${theme.primaryColor}`, color: theme.primaryColor, fontSize: '0.875rem', textDecoration: 'none' }}>
                  ← Previous
                </a>
              )}
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <a key={p} href={`${blogUrl}/tags/${tagToSlug(originalTag)}?page=${p}`} style={{
                  padding: '0.5rem 0.875rem', borderRadius: '0.5rem', fontSize: '0.875rem',
                  fontWeight: p === page ? 700 : 400,
                  color: p === page ? '#fff' : theme.primaryColor,
                  backgroundColor: p === page ? theme.primaryColor : 'transparent',
                  border: `1px solid ${theme.primaryColor}`, textDecoration: 'none',
                }}>
                  {p}
                </a>
              ))}
              {page < totalPages && (
                <a href={`${blogUrl}/tags/${tagToSlug(originalTag)}?page=${page + 1}`} style={{ padding: '0.6rem 1.25rem', borderRadius: '0.5rem', border: `1px solid ${theme.primaryColor}`, color: theme.primaryColor, fontSize: '0.875rem', textDecoration: 'none' }}>
                  Next →
                </a>
              )}
            </div>
          )}
        </div>

        <BlogSidebar sidebar={sidebar} theme={theme} blogUrl={blogUrl} />
      </div>
    </div>
  )
}
