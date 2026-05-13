export interface BlogNavLink {
  label: string
  url: string
}

export interface BlogTheme {
  primaryColor: string
  backgroundColor: string
  textColor: string
  headingFont: string
  bodyFont: string
  logoUrl: string | null
  logoAlt: string | null
  navLinks: BlogNavLink[]
  extractedAt: string | null
}

export const DEFAULT_BLOG_THEME: BlogTheme = {
  primaryColor: '#4f46e5',
  backgroundColor: '#ffffff',
  textColor: '#1a1a1a',
  headingFont: 'system-ui, -apple-system, sans-serif',
  bodyFont: 'Georgia, "Times New Roman", serif',
  logoUrl: null,
  logoAlt: null,
  navLinks: [],
  extractedAt: null,
}

export interface BlogTenant {
  id: string
  name: string
  domain: string
  white_label_domain: string | null
  blog_theme: BlogTheme
}

export interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt: string | null
  body_mdx: string | null
  published_at: string | null
  tags: string[] | null
  hero_image_url: string | null
  hero_image_alt: string | null
}
