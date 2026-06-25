/**
 * Per-brand fixed blog category sets.
 *
 * Clem assigns 1–2 categories from the brand's list instead of inventing
 * free-form tags — this avoids the single-use tag sprawl (e.g. "bespoke-jigsaw1")
 * that creates thin archive pages and a crawl/quality liability. Because the
 * consumer sites already render `tags`, making tags BE these categories turns the
 * existing tag sidebar into clean category navigation with no consumer change.
 *
 * Keyed by the first domain label (e.g. "fun4guests.com" -> "fun4guests").
 * Brands not listed fall back to the previous free-form tagging.
 */
const CATEGORIES: Record<string, string[]> = {
  fun4guests: [
    'Weddings',
    'Corporate & Product Launches',
    'Charity & Fundraising',
    'Garden & Outdoor Games',
    'Photo Attractions',
    'Party & Celebration Ideas',
  ],
  megacheques: [
    'Charity & Fundraising',
    'Prize Presentations & Awards',
    'Buying Guides',
    'Events & Occasions',
  ],
}

/** Fixed category list for a tenant domain, or [] if the brand uses free-form tags. */
export function categoriesForDomain(domain: string | null | undefined): string[] {
  if (!domain) return []
  const slug = domain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('.')[0]
    .toLowerCase()
  return CATEGORIES[slug] ?? []
}
