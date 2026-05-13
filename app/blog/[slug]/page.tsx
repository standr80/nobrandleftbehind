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

  const bodyHtml = post.body_mdx ? await toHtml(post.body_mdx) : ''
  const theme = tenant.blog_theme
  const blogUrl = `https://${blogHost}`

  return (
    <article>
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
        {post.tags && post.tags.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            {post.tags.map((tag) => (
              <a
                key={tag}
                href={`${blogUrl}/tags/${encodeURIComponent(tag)}`}
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: theme.primaryColor,
                  padding: '0.25rem 0.625rem',
                  borderRadius: '0.25rem',
                  border: `1px solid ${theme.primaryColor}`,
                }}
              >
                {tag}
              </a>
            ))}
          </div>
        )}

        {/* Title */}
        <h1 style={{
          fontFamily: theme.headingFont,
          fontSize: 'clamp(1.75rem, 5vw, 2.75rem)',
          fontWeight: 800,
          lineHeight: 1.2,
          marginBottom: '1rem',
          color: theme.textColor,
        }}>
          {post.title}
        </h1>

        {/* Date */}
        {post.published_at && (
          <time style={{ fontSize: '0.875rem', opacity: 0.5, display: 'block', marginBottom: '2.5rem' }}>
            {new Date(post.published_at).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          </time>
        )}

        {/* Body */}
        <div
          style={{ fontFamily: theme.bodyFont }}
          dangerouslySetInnerHTML={{ __html: addPostStyles(bodyHtml, theme.primaryColor, theme.headingFont) }}
        />

        {/* Back link */}
        <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
          <a href={blogUrl} style={{ fontSize: '0.875rem', color: theme.primaryColor, fontWeight: 500 }}>
            ← All articles
          </a>
        </div>
      </div>
    </article>
  )
}

/** Inject scoped CSS for the post body so prose styles don't rely on Tailwind */
function addPostStyles(html: string, primaryColor: string, headingFont: string): string {
  const css = `
<style>
  .post-body h1, .post-body h2, .post-body h3, .post-body h4 {
    font-family: ${headingFont};
    font-weight: 700;
    line-height: 1.3;
    margin: 2rem 0 0.75rem;
  }
  .post-body h1 { font-size: 1.75rem; }
  .post-body h2 { font-size: 1.4rem; }
  .post-body h3 { font-size: 1.15rem; }
  .post-body p { margin: 0 0 1.25rem; }
  .post-body ul, .post-body ol { margin: 0 0 1.25rem; padding-left: 1.5rem; }
  .post-body li { margin-bottom: 0.4rem; }
  .post-body a { color: ${primaryColor}; }
  .post-body blockquote {
    border-left: 3px solid ${primaryColor};
    margin: 1.5rem 0;
    padding: 0.75rem 1.25rem;
    opacity: 0.85;
    font-style: italic;
  }
  .post-body img {
    border-radius: 0.5rem;
    margin: 1.5rem auto;
  }
  .post-body pre {
    background: rgba(0,0,0,0.05);
    border-radius: 0.5rem;
    padding: 1rem 1.25rem;
    overflow-x: auto;
    font-size: 0.875rem;
    margin: 1.5rem 0;
  }
  .post-body code {
    font-size: 0.875em;
    background: rgba(0,0,0,0.06);
    padding: 0.15em 0.35em;
    border-radius: 0.25rem;
  }
  .post-body pre code { background: none; padding: 0; }
  .post-body hr { border: none; border-top: 1px solid rgba(0,0,0,0.1); margin: 2rem 0; }
  .post-body strong { font-weight: 700; }
</style>
<div class="post-body">${html}</div>`
  return css
}
