import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Edge-runtime middleware that redirects anonymous requests to /auth/signin.
 *
 * We can't run the full NextAuth auth() helper here because it transitively
 * pulls in the Prisma adapter (database-session strategy), which needs Node
 * APIs the Edge runtime does not provide. Instead we check for the session
 * cookie directly. The authoritative session validation happens in the Node
 * runtime inside server components/actions via `auth()` and the session helper.
 */
const SESSION_COOKIE_NAMES = [
  'authjs.session-token',
  '__Secure-authjs.session-token',
];

function hasSessionCookie(req: NextRequest): boolean {
  return SESSION_COOKIE_NAMES.some(name => req.cookies.has(name));
}

export default function middleware(req: NextRequest) {
  // Escape hatch for Playwright smoke tests: skip auth entirely so existing
  // specs continue to work without needing a session cookie.
  if (process.env.PLAYWRIGHT_TEST === 'true') return NextResponse.next();

  const { pathname, search } = req.nextUrl;
  const isAuthRoute = pathname.startsWith('/auth/');
  const isAuthApi = pathname.startsWith('/api/auth/');
  // Phase 1 skill API uses Bearer JWT, not NextAuth cookies. Cookie-based
  // redirect doesn't apply — let the route handlers run their own auth gate
  // (lib/api/bearer.ts) and return 401 JSON instead of a 307 to /auth/signin.
  const isBearerApi =
    pathname === '/api/me' ||
    pathname.startsWith('/api/runs') ||
    pathname.startsWith('/api/entries') ||
    pathname.startsWith('/api/milestones') ||
    pathname.startsWith('/api/todos') ||
    /^\/api\/projects\/[^/]+\/(entries|milestones|todos)/.test(pathname);

  if (isAuthRoute || isAuthApi || isBearerApi) return NextResponse.next();

  if (!hasSessionCookie(req)) {
    const signInUrl = new URL('/auth/signin', req.nextUrl.origin);
    signInUrl.searchParams.set('callbackUrl', pathname + search);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except Next static assets, favicon, and files with extensions.
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
