/**
 * The /dev index is driven entirely by this manifest. To publish a new R&D
 * document: drop the file into `public/dev-docs/<activity>/` and add an entry
 * here. Nothing else needs changing.
 *
 * `kind` decides how the "View" link behaves:
 *   md   — rendered to HTML by /dev/[activity]/[doc]
 *   html — served as-is (already a complete styled page)
 *   pdf  — opened in the browser's native PDF viewer
 */

export type DocKind = 'md' | 'html' | 'pdf'

export interface DevDoc {
  /** URL segment, and the filename stem in public/dev-docs/<activity>/ */
  slug: string
  file: string
  kind: DocKind
  title: string
  summary: string
}

export interface DevActivity {
  slug: string
  title: string
  summary: string
  updated: string
  docs: DevDoc[]
}

export const DEV_ACTIVITIES: DevActivity[] = [
  {
    slug: 'etsy-planning',
    title: 'Etsy Planning',
    summary:
      'Launching our own Etsy shop for personalised wedding and celebration signage, printed and dispatched in-house. Market research, product range, pricing and the Phase One production brief.',
    updated: '25 August 2026',
    docs: [
      {
        slug: 'phase-one-print-brief',
        file: 'phase-one-print-brief.html',
        kind: 'html',
        title: 'Phase One Sample Run',
        summary:
          'Production brief for the Print team. Items to produce, substrates, sizes, artwork specs, placeholder copy, photography requirements and the 80-name guest list.',
      },
      {
        slug: 'guest-name-checklist',
        file: 'phase-one-guest-name-checklist.pdf',
        kind: 'pdf',
        title: 'Guest Name Checklist',
        summary:
          'Printable two-page tick sheet — 80 guest names across ten tables, with a column for each of the two seating plans.',
      },
      {
        slug: 'range-plan',
        file: 'betsy-range-plan.md',
        kind: 'md',
        title: 'Product Range Plan',
        summary:
          'What to stock and what to charge. Built from 26 competitor listings across 7 shops: positioning, design families, product tiers, the full price card and launch phasing.',
      },
      {
        slug: 'project-briefing',
        file: 'etsy-shop-project-briefing.md',
        kind: 'md',
        title: 'Project Briefing',
        summary:
          'Origin and ground rules for the project, including the IP constraints that govern how competitor research may and may not be used.',
      },
      {
        slug: 'build-spec',
        file: 'betsy-build-spec.md',
        kind: 'md',
        title: 'Betsy Build Spec',
        summary:
          'Technical spec for the internal tool that would eventually run the shop. Reference only — not scheduled, and not needed to launch.',
      },
    ],
  },
]

export function getActivity(slug: string): DevActivity | undefined {
  return DEV_ACTIVITIES.find((a) => a.slug === slug)
}

export function getDoc(activitySlug: string, docSlug: string): DevDoc | undefined {
  return getActivity(activitySlug)?.docs.find((d) => d.slug === docSlug)
}

/** Public path of the raw file — used for both viewing and downloading. */
export function docHref(activitySlug: string, doc: DevDoc): string {
  return `/dev-docs/${activitySlug}/${doc.file}`
}

/** Where "View" points: rendered page for markdown, the file itself otherwise. */
export function viewHref(activitySlug: string, doc: DevDoc): string {
  return doc.kind === 'md' ? `/dev/${activitySlug}/${doc.slug}` : docHref(activitySlug, doc)
}
