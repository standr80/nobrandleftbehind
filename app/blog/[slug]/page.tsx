import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getTenantByBlogHost } from '@/lib/blog/getTenantByBlogHost'
import { createAdminClient } from '@/lib/supabase/admin'
import { toHtml } from '@/lib/mdx/toHtml'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const host = (await headers()).get('x-blog-host') ?? ''
  const tenant = host ? await getTenantByBlogHost(host) : null
  if (!tenant) return {}

  const db = createAdminClient()
  const { data: post } = await db
    .from('blog_posts')
    .select('title, excerpt, hero_image_url, published_at')
    .eq('tenant_id', tenant.id)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (!post) return {}

  const blogUrl = `https://${host}`
  return {
    title: `${post.title} | ${tenant.name}`,
    description: post.excerpt ?? undefined,
    alternates: { canonical: `${blogUrl}/${slug}` },
    openGraph: {
      title: post.title,
      description: post.excerpt ?? undefined,
      url: `${blogUrl}/${slug}`,
      type: 'article',
      publishedTime: post.published_at ?? undefined,
      images: post.hero_image_url ? [{ url: post.hero_image_url }] : [],
    },
    twitter: {
      card: post.hero_image_url ? 'summary_large_image' : 'summary',
      title: post.title,
      description: post.excerpt ?? undefined,
      images: post.hero_image_url ? [post.hero_image_url] : [],
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const headersList = await headers()
  const blogHost = headersList.get('x-blog-host')
  if (!blogHost) notFound()

  const tenant = await getTenantByBlogHost(blogHost)
  if (!tenant) notFound()

  const db = createAdminClient()

  const { data: post } = await db
    .from('blog_posts')
    .select('title, slug, excerpt, published_at, tags, hero_image_url, hero_image_alt, body_mdx')
    .eq('tenant_id', tenant.id)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (!post) notFound()

  // Fetch related posts (same tags, exclude this post, max 3)
  const relatedPromise = (post.tags ?? []).length > 0
    ? db.from('blog_posts')
        .select('id, title, slug, excerpt, published_at, tags, hero_image_url, hero_image_alt')
        .eq('tenant_id', tenant.id)
        .eq('status', 'published')
        .neq('slug', slug)
        .overlaps('tags', post.tags ?? [])
        .order('published_at', { ascending: false })
        .limit(3)
    : Promise.resolve({ data: [] })

  const [bodyHtml, { data: relatedPosts }] = await Promise.all([
    post.body_mdx ? toHtml(post.body_mdx) : Promise.resolve(''),
    relatedPromise,
  ])

  const theme = tenant.blog_theme
  const blogUrl = `https://${blogHost}`

  const postCss = `
    .post-body h1,.post-body h2,.post-body h3,.post-body h4 { font-family: ${theme.headingFont}; font-weight: 700; line-height: 1.3; margin: 2rem 0 0.75rem; }
    .post-body h1 { font-size: 1.75rem; }
    .post-body h2 { font-size: 1.4rem; }
    .post-body h3 { font-size: 1.15rem; }
    .post-body p { margin: 0 0 1.25rem; }
    .post-body ul,.post-body ol { margin: 0 0 1.25rem; padding-left: 1.5rem; }
    .post-body li { margin-bottom: 0.4rem; }
    .post-body a { color: ${theme.primaryColor}; }
    .post-body blockquote { border-left: 3px solid ${theme.primaryColor}; margin: 1.5rem 0; padding: 0.75rem 1.25rem; opacity: 0.85; font-style: italic; }
    .post-body img { border-radius: 0.5rem; margin: 1.5rem auto; }
    .post-body pre { background: rgba(0,0,0,0.05); border-radius: 0.5rem; padding: 1rem 1.25rem; overflow-x: auto; font-size: 0.875rem; margin: 1.5rem 0; }
    .post-body code { font-size: 0.875em; background: rgba(0,0,0,0.06); padding: 0.15em 0.35em; border-radius: 0.25rem; }
    .post-body pre code { background: none; padding: 0; }
    .post-body hr { border: none; border-top: 1px solid rgba(0,0,0,0.1); margin: 2rem 0; }
    .post-body strong { font-weight: 700; }
    .post-body mark { background: #fef08a; padding: 0.1em 0.2em; border-radius: 2px; }
    .post-body u { text-decoration: underline; }
    .post-body table { border-collapse: collapse; width: 100%; margin: 1.5rem 0; font-size: 0.9em; }
    .post-body th,.post-body td { border: 1px solid rgba(0,0,0,0.12); padding: 0.5em 0.75em; text-align: left; }
    .post-body th { background: rgba(0,0,0,0.04); font-weight: 600; }
    .post-body iframe { max-width: 100%; border-radius: 0.5rem; margin: 1.5rem 0; }
    .related-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; }
    @media (max-width: 640px) { .related-grid { grid-template-columns: 1fr; } }
  `

  return (
    <article>
      <style dangerouslySetInnerHTML={{ __html: postCss }} />

      {/* Hero image */}
      {post.hero_image_url && (
        <div style={{ width: '100%', maxHeight: '480px', overflow: 'hidden' }}>
          <img
            src={post.hero_image_url}
            alt={post.hero_image_alt ?? post.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
      )}

      <div style={{ maxWidth: '740px', margin: '0 auto', padding: '2.5rem 1.5rem 4rem' }}>

        {/* Tags */}
        {(post.tags ?? []).length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            {(post.tags ?? []).map((tag) => (
              <a key={tag} href={`${blogUrl}/tags/${encodeURIComponent(tag)}`} style={{
                fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.06em', color: theme.primaryColor,
                padding: '0.25rem 0.625rem', borderRadius: '0.25rem',
                border: `1px solid ${theme.primaryColor}`, textDecoration: 'none',
              }}>
                {tag}
              </a>
            ))}
          </div>
        )}

        {/* Title */}
        <h1 style={{
          fontFamily: theme.headingFont,
          fontSize: 'clamp(1.75rem, 5vw, 2.75rem)',
          fontWeight: 800, lineHeight: 1.2,
          marginBottom: '1rem', color: theme.textColor,
        }}>
          {post.title}
        </h1>

        {/* Date */}
        {post.published_at && (
          <time style={{ fontSize: '0.875rem', opacity: 0.5, display: 'block', marginBottom: '2.5rem' }}>
            {new Date(post.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </time>
        )}

        {/* Body */}
        <div
          className="post-body"
          style={{ fontFamily: theme.bodyFont }}
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />

        {/* Back link */}
        <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
          <a href={blogUrl} style={{ fontSize: '0.875rem', color: theme.primaryColor, fontWeight: 500, textDecoration: 'none' }}>
            ← All articles
          </a>
        </div>
      </div>

      {/* Related posts */}
      {(relatedPosts ?? []).length > 0 && (
        <div style={{
          borderTop: '1px solid rgba(0,0,0,0.08)',
          backgroundColor: `${theme.primaryColor}06`,
          padding: '3rem 1.5rem',
        }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <h2 style={{
              fontFamily: theme.headingFont, fontSize: '1rem', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              opacity: 0.5, marginBottom: '1.5rem',
            }}>
              More articles
            </h2>
            <div className="related-grid">
              {(relatedPosts ?? []).map((rp) => (
                <a
                  key={rp.id}
                  href={`${blogUrl}/${rp.slug}`}
                  style={{
                    display: 'flex', flexDirection: 'column',
                    border: '1px solid rgba(0,0,0,0.08)', borderRadius: '0.875rem',
                    overflow: 'hidden', backgroundColor: theme.backgroundColor,
                    color: 'inherit', textDecoration: 'none',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                  }}
                >
                  {rp.hero_image_url && (
                    <div style={{ aspectRatio: '16/9', overflow: 'hidden' }}>
                      <img src={rp.hero_image_url} alt={rp.hero_image_alt ?? rp.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                  <div style={{ padding: '1rem' }}>
                    <h3 style={{
                      fontFamily: theme.headingFont, fontSize: '0.95rem',
                      fontWeight: 700, lineHeight: 1.35, marginBottom: '0.5rem', color: theme.textColor,
                    }}>
                      {rp.title}
                    </h3>
                    <time style={{ fontSize: '0.75rem', opacity: 0.4 }}>
                      {rp.published_at ? new Date(rp.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                    </time>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </article>
  )
}
