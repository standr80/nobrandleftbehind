import type { Metadata } from 'next'
import MarketingNav from '@/components/marketing/MarketingNav'
import MarketingFooter from '@/components/marketing/MarketingFooter'

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nobrandleftbehind.com'
const TITLE = 'Academy — Courses on AI agents & great content'
const DESCRIPTION =
  'Learn to get the most from Clem, Scout, and the craft of content marketing. Online and face-to-face courses from No Brand Left Behind.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/academy` },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/academy`,
    siteName: 'No Brand Left Behind',
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
}

type Delivery = 'online' | 'in-person'
type Level = 'Beginner' | 'Intermediate' | 'Advanced'

interface Course {
  title: string
  blurb: string
  delivery: Delivery
  level: Level
  duration: string
}

// Static placeholder catalogue — edit here until the Academy is DB-driven.
const courseGroups: { heading: string; description: string; courses: Course[] }[] = [
  {
    heading: 'Master your agents',
    description: 'Get hands-on with Clem and Scout and run them like a pro.',
    courses: [
      {
        title: 'Clem 101: Your first AI blog',
        blurb: 'Set up your brand voice, brief Clem, and publish your first SEO-ready post end to end.',
        delivery: 'online',
        level: 'Beginner',
        duration: '90 min',
      },
      {
        title: 'Scout for SEO: Reading the market',
        blurb: 'Turn competitor moves, keyword gaps, and rank movements into a content plan that wins.',
        delivery: 'online',
        level: 'Intermediate',
        duration: '2 hrs',
      },
      {
        title: 'Power workflows: Clem + Scout together',
        blurb: 'Build a closed loop where Scout finds the opportunity and Clem turns it into ranking content.',
        delivery: 'in-person',
        level: 'Advanced',
        duration: 'Half day',
      },
    ],
  },
  {
    heading: 'The craft of content',
    description: 'Timeless fundamentals that make any brand — and any agent — perform better.',
    courses: [
      {
        title: 'Why content still wins',
        blurb: 'The business case for consistent publishing, and how compounding content beats paid spend.',
        delivery: 'online',
        level: 'Beginner',
        duration: '60 min',
      },
      {
        title: 'Blogging that ranks and reads',
        blurb: 'Structure, search intent, and editing craft — write posts people and search engines both love.',
        delivery: 'online',
        level: 'Intermediate',
        duration: '3 hrs',
      },
      {
        title: 'Building a content engine',
        blurb: 'A workshop on strategy, cadence, and measurement to make content a reliable growth channel.',
        delivery: 'in-person',
        level: 'Advanced',
        duration: 'Full day',
      },
    ],
  },
]

function DeliveryBadge({ delivery }: { delivery: Delivery }) {
  const online = delivery === 'online'
  return (
    <span
      className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
        online
          ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
          : 'bg-amber-50 text-amber-700 border-amber-200'
      }`}
    >
      {online ? '💻 Online' : '🤝 Face to face'}
    </span>
  )
}

export default function AcademyPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900 flex flex-col">
      <MarketingNav />

      {/* Hero */}
      <section className="px-6 py-20 text-center border-b border-slate-100">
        <div className="max-w-3xl mx-auto">
          <p className="text-sm font-medium text-indigo-600 mb-4 tracking-wide uppercase">Academy</p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 mb-6 leading-tight">
            Learn the agents. Master the craft.
          </h1>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Practical training on Clem, Scout, and the fundamentals of great content — delivered
            online and in person. Whether you&apos;re new to AI agents or scaling a content engine,
            there&apos;s a course for you.
          </p>
        </div>
      </section>

      {/* Course catalogue */}
      <section className="px-6 py-16 flex-1">
        <div className="max-w-5xl mx-auto space-y-16">
          {courseGroups.map((group) => (
            <div key={group.heading}>
              <div className="mb-8">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">{group.heading}</h2>
                <p className="text-sm text-slate-500 mt-1.5">{group.description}</p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {group.courses.map((course) => (
                  <div
                    key={course.title}
                    className="rounded-2xl border border-slate-200 p-6 flex flex-col hover:border-indigo-200 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <DeliveryBadge delivery={course.delivery} />
                      <span className="text-xs text-slate-400">{course.level}</span>
                    </div>
                    <h3 className="text-base font-semibold text-slate-900 mb-2">{course.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed flex-1">{course.blurb}</p>
                    <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100">
                      <span className="text-xs text-slate-400">{course.duration}</span>
                      <a
                        href={`mailto:academy@nobrandleftbehind.com?subject=${encodeURIComponent(`Interested: ${course.title}`)}`}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                      >
                        Register interest →
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 bg-slate-900">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-4">
            Want a course for your team?
          </h2>
          <p className="text-lg text-slate-300 mb-10 max-w-xl mx-auto leading-relaxed">
            We run private and bespoke sessions for teams, both online and on-site. Tell us what
            you&apos;re trying to achieve and we&apos;ll tailor the training.
          </p>
          <a
            href="mailto:academy@nobrandleftbehind.com?subject=Team training enquiry"
            className="inline-block text-sm bg-white hover:bg-slate-100 text-slate-900 px-6 py-3 rounded-lg transition-colors font-medium"
          >
            Enquire about team training
          </a>
        </div>
      </section>

      <MarketingFooter />
    </main>
  )
}
