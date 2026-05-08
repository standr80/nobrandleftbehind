import { NextResponse } from 'next/server'
import { PENDING_INVITE_COOKIE } from '@/lib/workspace/active'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

interface Params {
  params: Promise<{ token: string }>
}

// GET /api/invite/[token]/begin
// Sets a pending-invite cookie then redirects to sign-up.
// Because SignUp uses forceRedirectUrl="/dashboard", we can't pass the
// invite token as a query param — the middleware reads this cookie after
// authentication and redirects back to /invite/[token].
export async function GET(_request: Request, { params }: Params) {
  const { token } = await params
  const response = NextResponse.redirect(`${APP_URL}/sign-up`)
  response.cookies.set(PENDING_INVITE_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  })
  return response
}
