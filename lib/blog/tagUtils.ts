/**
 * Convert a stored tag like "small business marketing"
 * to a URL-safe slug "small-business-marketing".
 */
export function tagToSlug(tag: string): string {
  return tag
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
}

/**
 * Find the original stored tag that matches a URL slug.
 * Falls back to checking if the slug itself (URL-decoded) is an exact tag match,
 * which preserves backward compatibility with old space/percent-encoded URLs.
 */
export function slugToTag(slug: string, allTags: string[]): string | null {
  // Primary: match via normalised slug
  const bySlug = allTags.find((t) => tagToSlug(t) === slug)
  if (bySlug) return bySlug

  // Fallback: the slug might be a raw URL-decoded tag (old-style links)
  const decoded = decodeURIComponent(slug)
  return allTags.find((t) => t === decoded) ?? null
}
