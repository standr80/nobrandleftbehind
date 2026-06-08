'use client'

import { useState } from 'react'
import type { BlogNavLink } from '@/lib/blog/types'

/**
 * Blog header navigation. Renders inline links on wider screens and an
 * accessible hamburger toggle (button + aria-expanded/aria-controls) that
 * reveals a full-width dropdown on small screens. Visibility of the desktop
 * links vs the hamburger is handled by the media queries in the blog layout's
 * injected CSS (.blog-nav-desktop / .blog-burger).
 */
export default function BlogNav({ links }: { links: BlogNavLink[] }) {
  const [open, setOpen] = useState(false)
  if (!links.length) return null

  return (
    <>
      <nav className="blog-nav-desktop" aria-label="Primary">
        {links.map((link) => (
          <a key={link.url} href={link.url} className="blog-nav-link">
            {link.label}
          </a>
        ))}
      </nav>

      <button
        type="button"
        className="blog-burger"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        aria-controls="blog-mobile-menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">{open ? '✕' : '☰'}</span>
      </button>

      {open && (
        <nav id="blog-mobile-menu" className="blog-mobile-menu" aria-label="Mobile">
          {links.map((link) => (
            <a
              key={link.url}
              href={link.url}
              className="blog-mobile-link"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </a>
          ))}
        </nav>
      )}
    </>
  )
}
