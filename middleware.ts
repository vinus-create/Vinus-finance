import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/register', '/verify', '/api/auth', '/api/whatsapp', '/api/telegram']

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

export async function middleware(request: NextRequest) {
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

  // Use getSession() (reads JWT from cookie, no network call) for fast middleware routing.
  // Pages do their own getUser() for full server-side validation.
  const { data: { session } } = await supabase.auth.getSession()
  const isLoggedIn = !!session

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

  // Redirect authenticated users away from auth pages
  if (isPublicPath(pathname) && isLoggedIn && !pathname.startsWith('/api/')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
