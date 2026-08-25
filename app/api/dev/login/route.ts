import { NextResponse } from 'next/server'
import { DEV_COOKIE, DEV_COOKIE_MAX_AGE, devToken, isValidPassword, safeNext } from '@/lib/dev/auth'

/**
 * Accepts the /dev password form. Plain form POST rather than fetch, so the
 * gate keeps working with JavaScript unavailable and there is no client-side
 * state to get out of step.
 */
export async function POST(request: Request) {
  const form = await request.formData()
  const password = String(form.get('password') ?? '')
  const next = safeNext(String(form.get('next') ?? '/dev'))

  if (!process.env.DEV_PASSWORD) {
    const url = new URL('/dev/login', request.url)
    url.searchParams.set('error', 'unconfigured')
    return NextResponse.redirect(url, { status: 303 })
  }

  if (!(await isValidPassword(password))) {
    const url = new URL('/dev/login', request.url)
    url.searchParams.set('error', 'invalid')
    url.searchParams.set('next', next)
    return NextResponse.redirect(url, { status: 303 })
  }

  const response = NextResponse.redirect(new URL(next, request.url), { status: 303 })
  response.cookies.set({
    name: DEV_COOKIE,
    value: await devToken(process.env.DEV_PASSWORD),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DEV_COOKIE_MAX_AGE,
  })
  return response
}
