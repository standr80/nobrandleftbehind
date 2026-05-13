import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getTenantByBlogHost } from '@/lib/blog/getTenantByBlogHost'
import type { BlogTheme, BlogNavLink } from '@/lib/blog/types'
import type { ReactNode } from 'react'

interface BlogLayoutProps {
  children: ReactNode
}

function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '79, 70, 229'
  return `${r}, ${g}, ${b}`
}

function buildCssVars(theme: BlogTheme): string {
  return `
    :root {
      --brand-primary: ${theme.primaryColor};
      --brand-primary-rgb: ${hexToRgb(theme.primaryColor)};
      --brand-bg: ${theme.backgroundColor};
      --brand-text: ${theme.textColor};
      --brand-heading-font: ${theme.headingFont};
      --brand-body-font: ${theme.bodyFont};
    }
    *, *::before, *::after { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      background-color: var(--brand-bg);
      color: var(--brand-text);
      font-family: var(--brand-body-font);
      line-height: 1.7;
      margin: 0;
      -webkit-font-smoothing: antialiased;
    }
    h1, h2, h3, h4, h5, h6 {
      font-family: var(--brand-heading-font);
      line-height: 1.25;
    }
    a { color: var(--brand-primary); text-decoration: none; }
    a:hover { text-decoration: underline; }
    img { max-width: 100%; height: auto; display: block; }
  `.trim()
}

export default async function BlogLayout({ children }: BlogLayoutProps) {
  const headersList = await headers()
  const blogHost = headersList.get('x-blog-host')

  // Guard: if accessed directly on the platform domain (no blog host header),
  // return 404 rather than showing a blank or broken blog.
  if (!blogHost) notFound()

  const tenant = await getTenantByBlogHost(blogHost)
  if (!tenant) notFound()

  const { blog_theme: theme, name, domain } = tenant
  const homeUrl = `https://${domain}`
  const blogUrl = `https://${blogHost}`

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style dangerouslySetInnerHTML={{ __html: buildCssVars(theme) }} />
        <link rel="alternate" type="application/rss+xml" title={`${name} Blog`} href={`${blogUrl}/feed.xml`} />
      </head>
      <body>
        {/* ── Header ── */}
        <header style={{
          borderBottom: `1px solid rgba(${hexToRgb(theme.textColor)}, 0.1)`,
          backgroundColor: theme.backgroundColor,
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}>
          <div style={{
            maxWidth: '1100px',
            margin: '0 auto',
            padding: '0 1.5rem',
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '2rem',
          }}>
            {/* Logo / brand */}
            <a href={homeUrl} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
              {theme.logoUrl ? (
                <img
                  src={theme.logoUrl}
                  alt={theme.logoAlt ?? name}
                  style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
                />
              ) : (
                <span style={{
                  fontFamily: theme.headingFont,
                  fontWeight: 700,
                  fontSize: '1.1rem',
                  color: theme.primaryColor,
                }}>
                  {name}
                </span>
              )}
            </a>

            {/* Navigation */}
            <nav style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
              {theme.navLinks.map((link: BlogNavLink) => (
                <a
                  key={link.url}
                  href={link.url}
                  style={{
                    fontSize: '0.875rem',
                    fontFamily: theme.headingFont,
                    color: theme.textColor,
                    padding: '0.375rem 0.75rem',
                    borderRadius: '0.5rem',
                    transition: 'background 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = `rgba(${hexToRgb(theme.primaryColor)}, 0.08)`
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                  }}
                >
                  {link.label}
                </a>
              ))}
              {/* Always show "Blog" as current section */}
              <a
                href={blogUrl}
                style={{
                  fontSize: '0.875rem',
                  fontFamily: theme.headingFont,
                  color: theme.primaryColor,
                  fontWeight: 600,
                  padding: '0.375rem 0.75rem',
                  borderRadius: '0.5rem',
                  backgroundColor: `rgba(${hexToRgb(theme.primaryColor)}, 0.08)`,
                  whiteSpace: 'nowrap',
                }}
              >
                Blog
              </a>
            </nav>
          </div>
        </header>

        {/* ── Page content ── */}
        <main style={{ minHeight: 'calc(100vh - 64px - 80px)' }}>
          {children}
        </main>

        {/* ── Footer ── */}
        <footer style={{
          borderTop: `1px solid rgba(${hexToRgb(theme.textColor)}, 0.1)`,
          padding: '1.5rem',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: '0.8rem', opacity: 0.5, margin: 0 }}>
            © {new Date().getFullYear()} {name} · <a href={homeUrl}>{domain}</a>
          </p>
        </footer>
      </body>
    </html>
  )
}
