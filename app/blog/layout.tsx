import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getTenantByBlogHost } from '@/lib/blog/getTenantByBlogHost'
import type { BlogNavLink } from '@/lib/blog/types'
import type { ReactNode } from 'react'

interface BlogLayoutProps {
  children: ReactNode
}

function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return '79, 70, 229'
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '79, 70, 229'
  return `${r}, ${g}, ${b}`
}

export default async function BlogLayout({ children }: BlogLayoutProps) {
  const headersList = await headers()
  const blogHost = headersList.get('x-blog-host')

  if (!blogHost) notFound()

  const tenant = await getTenantByBlogHost(blogHost)
  if (!tenant) notFound()

  const { blog_theme: theme, name, domain } = tenant
  const homeUrl = `https://${domain}`
  const blogUrl = `https://${blogHost}`

  const primaryRgb = hexToRgb(theme.primaryColor)
  const textRgb = hexToRgb(theme.textColor)

  const globalCss = `
    *, *::before, *::after { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      background-color: ${theme.backgroundColor};
      color: ${theme.textColor};
      font-family: ${theme.bodyFont};
      line-height: 1.7;
      margin: 0;
      -webkit-font-smoothing: antialiased;
    }
    h1, h2, h3, h4, h5, h6 {
      font-family: ${theme.headingFont};
      line-height: 1.25;
    }
    a { color: ${theme.primaryColor}; text-decoration: none; }
    a:hover { text-decoration: underline; }
    img { max-width: 100%; height: auto; display: block; }
    .blog-nav-link {
      font-size: 0.875rem;
      font-family: ${theme.headingFont};
      color: ${theme.textColor};
      padding: 0.375rem 0.75rem;
      border-radius: 0.5rem;
      transition: background 0.15s;
      white-space: nowrap;
      text-decoration: none;
    }
    .blog-nav-link:hover {
      background-color: rgba(${primaryRgb}, 0.08);
      text-decoration: none;
    }
    .blog-nav-active {
      font-size: 0.875rem;
      font-family: ${theme.headingFont};
      color: ${theme.primaryColor};
      font-weight: 600;
      padding: 0.375rem 0.75rem;
      border-radius: 0.5rem;
      background-color: rgba(${primaryRgb}, 0.08);
      white-space: nowrap;
      text-decoration: none;
    }
  `.trim()

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: globalCss }} />

      {/* ── Header ── */}
      <header style={{
        borderBottom: `1px solid rgba(${textRgb}, 0.1)`,
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
          <a href={homeUrl} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0, textDecoration: 'none' }}>
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
              <a key={link.url} href={link.url} className="blog-nav-link">
                {link.label}
              </a>
            ))}
            <a href={blogUrl} className="blog-nav-active">
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
        borderTop: `1px solid rgba(${textRgb}, 0.1)`,
        padding: '1.5rem',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: '0.8rem', opacity: 0.5, margin: 0 }}>
          © {new Date().getFullYear()} {name} · <a href={homeUrl}>{domain}</a>
        </p>
      </footer>
    </>
  )
}
