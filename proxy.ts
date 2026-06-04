import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/register', '/verify', '/api/auth', '/api/whatsapp', '/api/telegram', '/api/pwa-icon']
// Auth-required but exempt from "redirect logged-in users away" rule
const AUTH_EXEMPT = ['/onboarding']

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Use getUser() to validate the session against Supabase server.
  // This also refreshes the access token if it has expired (using the refresh token).
  // Prevents the stale-cookie redirect loop where getSession() returns a user
  // but getUser() in pages returns null (causing /dashboard → /login → /dashboard loop).
  const { data: { user } } = await supabase.auth.getUser()
  const isLoggedIn = !!user

  const { pathname } = request.nextUrl

  // Redirect root to dashboard or login
  if (pathname === '/') {
    const redirectTo = isLoggedIn ? '/dashboard' : '/login'
    return NextResponse.redirect(new URL(redirectTo, request.url))
  }

  // Guard protected routes
  if (!isPublicPath(pathname) && !isLoggedIn) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth pages (but NOT onboarding)
  const isAuthExempt = AUTH_EXEMPT.some(p => pathname === p || pathname.startsWith(p + '/'))
  if (isPublicPath(pathname) && isLoggedIn && !pathname.startsWith('/api/') && !isAuthExempt) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
