import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Routes that never need a session
const ALWAYS_PUBLIC = ['/api/stripe/webhook']

// Auth pages — authenticated users should be sent to /dashboard
const AUTH_PAGES = ['/login', '/register']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip session logic for truly public API prefixes
  if (ALWAYS_PUBLIC.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Refresh the Supabase session on every request
  const { supabaseResponse, user } = await updateSession(request)

  // ── Root: redirect based on auth state ──────────────────────────
  if (pathname === '/') {
    const dest = user ? '/dashboard' : '/login'
    return NextResponse.redirect(new URL(dest, request.url))
  }

  // ── Auth pages: already logged-in → /dashboard ──────────────────
  if (AUTH_PAGES.includes(pathname) && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // ── /onboarding: requires session ───────────────────────────────
  if (pathname.startsWith('/onboarding') && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // ── /dashboard/*: requires session ──────────────────────────────
  if (pathname.startsWith('/dashboard') && !user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
