import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { ACTIVE_WORKSPACE_COOKIE, PENDING_INVITE_COOKIE } from '@/lib/workspace/active'

const isPublicRoute = createRouteMatcher([
  '/',               // marketing landing page
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/invite(.*)',     // workspace invite acceptance page
  '/api/invite(.*)', // invite API routes (begin, accept)
  '/api/webhooks(.*)', // Inngest + GitHub webhooks are verified internally
  '/api/feed(.*)',  // public embed feed — no auth, CORS open
  '/preview/embed(.*)', // iframe preview for embed builder
])

// Platform routes where the workspace cookie must be valid
const isWorkspaceRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/author(.*)',
  '/settings(.*)',
])

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) return NextResponse.next()

  await auth.protect()

  const pathname = request.nextUrl.pathname

  // After sign-up/sign-in: if a pending invite cookie exists and the user
  // isn't already on the invite page, redirect them there to accept.
  const pendingInvite = request.cookies.get(PENDING_INVITE_COOKIE)?.value
  if (pendingInvite && !pathname.startsWith('/invite/')) {
    return NextResponse.redirect(new URL(`/invite/${pendingInvite}`, request.url))
  }

  // On workspace routes: if the active_workspace_id cookie is present but
  // obviously malformed (not a UUID), clear it so getActiveWorkspace()
  // falls back to the user's first membership rather than failing silently.
  if (isWorkspaceRoute(request)) {
    const cookieVal = request.cookies.get(ACTIVE_WORKSPACE_COOKIE)?.value
    if (cookieVal && !/^[0-9a-f-]{36}$/i.test(cookieVal)) {
      const response = NextResponse.next()
      response.cookies.delete(ACTIVE_WORKSPACE_COOKIE)
      return response
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
