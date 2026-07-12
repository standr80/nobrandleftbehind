export type AgentStatus = 'live' | 'soon'

export interface Agent {
  id: string
  name: string
  role: string
  status: AgentStatus
  accent: string
  photo: string | null
  href: string | null // dashboard link (live agents)
  cta: string | null // CTA label (live agents)
  description: string // short blurb on the homepage card
  tagline: string // CV headline
  summary: string // CV profile paragraph
  skills: string[]
  experience: { title: string; points: string[] }[]
  tools?: string[]
}

export const agents: Agent[] = [
  {
    id: 'clem',
    name: 'Clem',
    role: 'Blog & FAQ content agent',
    status: 'live',
    accent: '#4f46e5',
    photo: '/agents/clem.jpg',
    href: '/dashboard',
    cta: 'Hire Clem',
    description:
      'Researches, writes, and queues SEO-ready blog posts and FAQ pages for your website — on a schedule you control.',
    tagline: 'Writes SEO-ready blog posts and FAQ pages, in your brand voice, on your schedule.',
    summary:
      'A content writer who researches search intent, drafts publish-ready articles and FAQ pages in your brand voice, and queues them for review — so your site keeps growing without you touching the keyboard.',
    skills: [
      'SEO copywriting',
      'Keyword research',
      'FAQ writing',
      'Brand-voice matching',
      'Internal linking',
      'Structured data (schema)',
      'Answer-engine optimisation',
      'British English',
    ],
    experience: [
      {
        title: 'Blog writing',
        points: [
          'Researches search intent and drafts 900–1,200-word posts in your voice.',
          'Answer-first structure, evergreen slugs, and purpose-built meta descriptions.',
          'Comparison tables and outbound citations where they earn trust.',
        ],
      },
      {
        title: 'FAQ pages',
        points: [
          'Builds topic-based FAQ pages with FAQPage schema for rich results and AI citation.',
          'Sources People-Also-Ask questions, or suggests them from scratch.',
          'Uses your verbatim answers where you have them.',
        ],
      },
      {
        title: 'Internal linking & authority',
        points: [
          'Weaves contextual internal links and keeps a “Related reading” block current.',
          'Funnels authority to your key commercial pages (hub-and-spoke).',
        ],
      },
      {
        title: 'Publishing',
        points: [
          'Publishes natively to Shopify (blog + FAQ), Git/Astro, or NBLB-hosted.',
          'Runs on a schedule you set, and pings IndexNow so AI engines see new content in hours.',
        ],
      },
    ],
    tools: ['Shopify', 'WordPress', 'Git / Astro', 'IndexNow', 'Supabase'],
  },
  {
    id: 'scout',
    name: 'Scout',
    role: 'SEO & market intelligence agent',
    status: 'live',
    accent: '#0d9488',
    photo: '/agents/scout.jpg',
    href: '/dashboard/scout',
    cta: 'Meet Scout',
    description:
      'Tracks your rankings, watches competitors, and surfaces keyword opportunities — then briefs Clem in one click.',
    tagline: 'Tracks rankings, watches rivals, and finds the opportunities worth chasing.',
    summary:
      'A research analyst who monitors where you rank, what your competitors publish, and which keywords are worth going after — then hands Clem a brief so insight turns straight into content.',
    skills: [
      'Rank tracking',
      'Competitor monitoring',
      'Keyword gap analysis',
      'People-Also-Ask mining',
      'SERP analysis',
      'Weekly briefings',
      'Clem hand-off',
    ],
    experience: [
      {
        title: 'Rank tracking',
        points: [
          'Weekly keyword-position snapshots with movement alerts and trend sparklines.',
        ],
      },
      {
        title: 'Competitor intelligence',
        points: ['Watches rivals for new content, pricing moves, and backlink gains.'],
      },
      {
        title: 'Opportunity spotting',
        points: [
          'Surfaces keyword gaps, featured-snippet targets, and rising People-Also-Ask questions.',
        ],
      },
      {
        title: 'Briefings',
        points: [
          'A concise weekly summary of what changed and what to do about it — one click to brief Clem.',
        ],
      },
    ],
    tools: ['Firecrawl', 'Google Search Console (planned)', 'Supabase'],
  },
  {
    id: 'hank',
    name: 'Hank',
    role: 'Sales prospecting agent',
    status: 'soon',
    accent: '#64748b',
    photo: '/agents/hank.jpg',
    href: null,
    cta: null,
    description:
      'Finds, qualifies, and nurtures sales prospects — automating the top of your sales funnel.',
    tagline: 'Fills the top of your funnel — finds, qualifies, and warms up prospects.',
    summary:
      'Automates prospecting so your pipeline never runs dry: sources leads, qualifies them against your ideal customer, and nurtures them until they’re ready to talk.',
    skills: ['Prospecting', 'Lead qualification', 'Outreach sequencing', 'CRM sync', 'Enrichment'],
    experience: [
      { title: 'Sourcing', points: ['Finds and enriches prospects that match your ideal customer.'] },
      { title: 'Qualification', points: ['Scores and prioritises leads so you work the best ones first.'] },
      { title: 'Nurture', points: ['Runs warm-up sequences and syncs everything to your CRM.'] },
    ],
  },
  {
    id: 'bailey',
    name: 'Bailey',
    role: 'Image & gallery agent',
    status: 'soon',
    accent: '#f59e0b',
    photo: null,
    href: null,
    cta: null,
    description:
      'Turns your unsorted event photos into optimised, captioned gallery pages built to rank in image and AI search.',
    tagline: 'Turns a bucket of photos into optimised, captioned gallery pages.',
    summary:
      'Point Bailey at a folder of event or product photos and get back a polished gallery page — resized, auto-captioned, schema-marked, and built to rank in image and AI search. Zero effort in, gallery out.',
    skills: [
      'Image optimisation',
      'AI alt-text & captions',
      'ImageObject schema',
      'Responsive images',
      'Gallery layout',
    ],
    experience: [
      { title: 'Ingest & optimise', points: ['Auto-orients, resizes, and compresses whatever you upload.'] },
      { title: 'Caption & describe', points: ['Writes descriptive alt text and captions with AI vision.'] },
      { title: 'Publish', points: ['Renders a gallery page with ImageObject schema and page copy.'] },
    ],
  },
  {
    id: 'pam',
    name: 'Pam',
    role: 'Personal assistant agent',
    status: 'soon',
    accent: '#8b5cf6',
    photo: null,
    href: null,
    cta: null,
    description:
      'Watches your content calendar and freshness and tells you exactly what to publish next — and when.',
    tagline: 'Your content PA — watches the calendar and tells you what to publish, and when.',
    summary:
      'Tracks when you last posted, when content is going stale, and which seasonal moments are coming up — then nudges you (or your agents) to act, so nothing slips through the cracks.',
    skills: [
      'Content calendar',
      'Freshness monitoring',
      'Seasonal awareness',
      'Cadence tracking',
      'Email digests',
    ],
    experience: [
      { title: 'Monitor', points: ['Watches internal dates (last post, content age) and external ones (seasonal events).'] },
      { title: 'Recommend', points: ['Flags what needs a new post and what needs refreshing — with topics ready to go.'] },
      { title: 'Remind', points: ['Sends an optional weekly digest so you stay consistent.'] },
    ],
  },
]

export function getAgent(id: string): Agent | undefined {
  return agents.find((a) => a.id === id)
}
