import { NextResponse } from 'next/server'
import { DEV_COOKIE } from '@/lib/dev/auth'

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL('/dev/login', request.url), { status: 303 })
  response.cookies.set({ name: DEV_COOKIE, value: '', path: '/', maxAge: 0 })
  return response
}
