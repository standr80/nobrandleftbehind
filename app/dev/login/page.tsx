import type { Metadata } from 'next'
import { safeNext } from '@/lib/dev/auth'

export const metadata: Metadata = {
  title: 'R&D — sign in',
  robots: { index: false, follow: false, nocache: true },
}

const MESSAGES: Record<string, string> = {
  invalid: 'That password is not right. Try again.',
  unconfigured:
    'No password is configured for this area yet. Set DEV_PASSWORD in Vercel and redeploy.',
}

export default async function DevLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>
}) {
  const { error, next } = await searchParams
  const target = safeNext(next)
  const message = error ? MESSAGES[error] : null

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center bg-slate-50 px-6 py-10">
      <p className="mb-6 text-xs text-slate-400">No Brand Left Behind</p>
      <h1 className="text-lg font-semibold tracking-tight text-slate-900">
        Research &amp; development
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">
        This area holds internal working documents. Enter the shared password to continue.
      </p>

      <form action="/api/dev/login" method="POST" className="mt-6 space-y-3">
        <input type="hidden" name="next" value={target} />
        <div>
          <label htmlFor="password" className="sr-only">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoFocus
            autoComplete="current-password"
            required
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            placeholder="Password"
          />
        </div>

        {message && (
          <p role="alert" className="text-sm text-red-600">
            {message}
          </p>
        )}

        <button
          type="submit"
          className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
        >
          Continue
        </button>
      </form>
    </div>
  )
}
