import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ACTIVE_WORKSPACE_COOKIE, PENDING_INVITE_COOKIE } from '@/lib/workspace/active'
import { DEV_COOKIE, isValidDevToken } from '@/lib/dev/auth'

const isPublicRoute = createRouteMatcher([
  '/',               // marketing landing page
  '/agents(.*)',     // public agent CV pages
  '/academy(.*)',    // public academy page
  '/repeatafterme(.*)',     // Répétez — public, no-account, BYOK language drill app
  '/api/repeatafterme(.*)', // Répétez API routes — BYOK, no NBLB auth required
  '/sitemap.xml',    // marketing sitemap (crawlers)
  '/robots.txt',     // marketing robots (crawlers)
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/invite(.*)',     // workspace invite acceptance page
  '/api/invite(.*)', // invite API routes (begin, accept)
  '/api/webhooks(.*)', // Inngest + GitHub webhooks are verified internally
  '/api/feed(.*)',  // public embed feed — no auth, CORS open
  '/api/content(.*)', // public Content API v1 — no auth, CORS open
  '/preview/embed(.*)', // iframe preview for embed builder
  '/api/dev(.*)',   // /dev password gate — guarded by its own cookie, not Clerk
  '/dev(.*)',       // ditto: the R&D area has its own gate below, Clerk must not
                    // redirect it to sign-in (it has no Clerk accounts at all)
])

// Platform routes where the workspace cookie must be valid
const isWorkspaceRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/author(.*)',
  '/settings(.*)',
])

/** Hostnames that belong to the Clem platform itself.
 *  Uses anchored regex so subdomains like blog.nobrandleftbehind.com
 *  are correctly treated as client blog hosts, not the platform.
 */
function isPlatformHost(host: string): boolean {
  // Strip port (present in dev: localhost:3000)
  const hostname = host.split(':')[0]
  return /^(www\.)?nobrandleftbehind\.(com|vercel\.app)$/i.test(hostname) ||
    // This project's own Vercel preview/branch deployments (e.g.
    // nobrandleftbehind-<hash>-richard-standens-projects.vercel.app) — without
    // this, every preview URL falls through to the blog-tenant branch below
    // and gets rewritten to /blog/* for a host that matches no real tenant.
    /^nobrandleftbehind-[a-z0-9-]+\.vercel\.app$/i.test(hostname) ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1'
}

export default clerkMiddleware(async (auth, request: NextRequest) => {
  const host = request.headers.get('host') ?? ''
  const pathname = request.nextUrl.pathname

  // ── Blog host routing ────────────────────────────────────────────────────────
  // Any request arriving on a non-platform domain is treated as a blog host.
  // We rewrite the path internally to app/blog/* while keeping the visitor's
  // address bar unchanged, and forward the original host as x-blog-host so
  // server components can look up the correct tenant.
  if (!isPlatformHost(host)) {
    const url = request.nextUrl.clone()
    url.pathname = '/blog' + (pathname === '/' ? '' : pathname)

    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-blog-host', host)

    return NextResponse.rewrite(url, { request: { headers: requestHeaders } })
  }

  // ── /dev R&D area ────────────────────────────────────────────────────────────
  // Shared-password area, entirely separate from Clerk: no accounts, no user
  // table. Covers the pages (/dev/*), the raw documents (/dev-docs/*) and the
  // logout route. The login page and its POST handler must stay reachable or
  // there would be no way in.
  const isDevArea =
    pathname === '/dev' ||
    pathname.startsWith('/dev/') ||
    pathname.startsWith('/dev-docs/') ||
    pathname === '/api/dev/logout'
  const isDevEntry = pathname === '/dev/login' || pathname === '/api/dev/login'

  if (isDevArea && !isDevEntry) {
    const ok = await isValidDevToken(request.cookies.get(DEV_COOKIE)?.value)
    if (!ok) {
      const url = request.nextUrl.clone()
      url.pathname = '/dev/login'
      url.search = ''
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  // ── Platform routing (unchanged) ─────────────────────────────────────────────
  if (isPublicRoute(request)) return NextResponse.next()

  await auth.protect()

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
    // Always run for the gated R&D documents. Without this the pattern above
    // would let /dev-docs/*.html through unauthenticated, because it skips
    // anything ending in a static-asset extension.
    '/dev-docs/:path*',
  ],
}
