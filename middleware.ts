import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Define route patterns
  const isPublicRoute = pathname === '/' || pathname === '/signup' || pathname.startsWith('/api/')
  const isProtectedRoute = pathname.startsWith('/patient') ||
                           pathname.startsWith('/assistant') ||
                           pathname.startsWith('/dentist')

  // Skip middleware for non-protected routes
  if (!isProtectedRoute) {
    return NextResponse.next()
  }

  // Dev preview bypass: /dentist?preview=1 skips auth
  if (request.nextUrl.searchParams.get('preview') === '1') {
    return NextResponse.next()
  }

  // Create a response object that we can modify
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  try {
    // Create Supabase client for middleware (edge-compatible)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value)
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    // Refresh the session - this is important for keeping sessions alive
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    // If no authenticated user, redirect to login
    if (authError || !user) {
      const redirectUrl = new URL('/', request.url)
      return NextResponse.redirect(redirectUrl)
    }

    // Get user role from profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .single()

    // If no profile found, redirect to login
    if (profileError || !profile) {
      const redirectUrl = new URL('/', request.url)
      return NextResponse.redirect(redirectUrl)
    }

    // If user is not active, redirect to login with status message
    if (profile.status !== 'active') {
      const redirectUrl = new URL('/?status=pending', request.url)
      return NextResponse.redirect(redirectUrl)
    }

    // Role-based route protection
    const roleRouteMap: Record<string, string> = {
      patient: '/patient',
      assistant: '/assistant',
      dentist: '/dentist',
    }

    const allowedRoute = roleRouteMap[profile.role]

    // If user is trying to access a route they don't have permission for,
    // redirect them to their correct dashboard
    if (allowedRoute && !pathname.startsWith(allowedRoute)) {
      const redirectUrl = new URL(allowedRoute, request.url)
      return NextResponse.redirect(redirectUrl)
    }

    return response
  } catch (error) {
    // On any error, redirect to login for safety
    const redirectUrl = new URL('/', request.url)
    return NextResponse.redirect(redirectUrl)
  }
}

export const config = {
  matcher: [
    '/patient/:path*',
    '/assistant/:path*',
    '/dentist/:path*',
  ],
}
