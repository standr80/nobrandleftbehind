import Link from 'next/link'

export default function MarketingFooter() {
  return (
    <footer className="border-t border-slate-100 px-6 py-6 max-w-7xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between gap-3">
      <p className="text-xs text-slate-400">
        © {new Date().getFullYear()} nobrandleftbehind. All rights reserved.
      </p>
      <div className="flex items-center flex-wrap justify-center gap-4 text-xs text-slate-400">
        <Link href="/#how-it-works" className="hover:text-slate-600 transition-colors">How it works</Link>
        <Link href="/#features" className="hover:text-slate-600 transition-colors">Features</Link>
        <Link href="/academy" className="hover:text-slate-600 transition-colors">Academy</Link>
        <Link href="/sign-in" className="hover:text-slate-600 transition-colors">Sign in</Link>
        <Link href="/sign-up" className="hover:text-slate-600 transition-colors">Sign up</Link>
      </div>
    </footer>
  )
}
