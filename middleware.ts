import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

async function getUserRole(supabase: any, userId: string): Promise<{ role: string; status: string } | null> {
  console.log('🔍 [MIDDLEWARE] Checking user role for ID:', userId)

  try {
    // Check if service role key is available
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log('⚠️ [MIDDLEWARE] Service role key not available, using regular client')
      // Fall back to regular client if service role not available
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, status')
        .eq('id', userId)
        .single()

      if (error) {
        if (error.code !== 'PGRST116') {
          console.error('🚨 [MIDDLEWARE] Error querying profiles table:', error)
        }
        return null
      }

      if (!profile) {
        console.log('❌ [MIDDLEWARE] No profile found for user')
        return null
      }

      console.log('✅ [MIDDLEWARE] Found user role:', profile.role, 'with status:', profile.status)
      return { role: profile.role, status: profile.status }
    }

    // Use service role to bypass RLS when available
    const serviceSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() { return [] },
          setAll() {}
        }
      }
    )

    const { data: profile, error } = await serviceSupabase
      .from('profiles')
      .select('role, status')
      .eq('id', userId)
      .single()

    if (error) {
      if (error.code !== 'PGRST116') {
        console.error('🚨 [MIDDLEWARE] Error querying profiles table:', error)
      }
      return null
    }

    if (!profile) {
      console.log('❌ [MIDDLEWARE] No profile found for user')
      return null
    }

    if (profile.status !== 'active' && profile.status !== 'pending') {
      console.log('❌ [MIDDLEWARE] User profile status not valid:', profile.status)
      return null
    }

    console.log('✅ [MIDDLEWARE] Found user role:', profile.role, 'with status:', profile.status)
    return { role: profile.role, status: profile.status }
  } catch (error) {
    console.error('🚨 [MIDDLEWARE] Exception in getUserRole:', error)
    return null
  }
}

export async function middleware(request: NextRequest) {
  try {
    let supabaseResponse = NextResponse.next({
      request,
    })

    // Check if required environment variables are available
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('🚨 [MIDDLEWARE] Missing required Supabase environment variables')
      return supabaseResponse
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({
              request,
            })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    let user = null
    try {
      const result = await supabase.auth.getUser()
      user = result.data?.user || null
    } catch (authError) {
      console.error('🚨 [MIDDLEWARE] Auth error:', authError)
      // Continue without user if auth fails
      user = null
    }

  const { pathname } = request.nextUrl

  const isPublicRoute = pathname === '/' || pathname === '/signup'
  const isProtectedRoute = pathname.startsWith('/patient') ||
                           pathname.startsWith('/assistant') ||
                           pathname.startsWith('/dentist')

  if (!user && isProtectedRoute) {
    const redirectUrl = new URL('/', request.url)
    return NextResponse.redirect(redirectUrl)
  }

  if (user && isProtectedRoute) {
    const userProfile = await getUserRole(supabase, user.id)
    if (!userProfile) {
      const redirectUrl = new URL('/', request.url)
      return NextResponse.redirect(redirectUrl)
    }

    // If user is pending, redirect to login page with message
    if (userProfile.status === 'pending') {
      const redirectUrl = new URL('/?status=pending', request.url)
      return NextResponse.redirect(redirectUrl)
    }

    // Only allow active users to access their role dashboard
    if (userProfile.status !== 'active') {
      const redirectUrl = new URL('/', request.url)
      return NextResponse.redirect(redirectUrl)
    }

    if (pathname.startsWith('/patient') && userProfile.role !== 'patient') {
      const redirectUrl = new URL(getRoleBasedRedirect(userProfile.role), request.url)
      return NextResponse.redirect(redirectUrl)
    }
    if (pathname.startsWith('/assistant') && userProfile.role !== 'assistant') {
      const redirectUrl = new URL(getRoleBasedRedirect(userProfile.role), request.url)
      return NextResponse.redirect(redirectUrl)
    }
    if (pathname.startsWith('/dentist') && userProfile.role !== 'dentist') {
      const redirectUrl = new URL(getRoleBasedRedirect(userProfile.role), request.url)
      return NextResponse.redirect(redirectUrl)
    }
  }

  if (user && isPublicRoute) {
    const userProfile = await getUserRole(supabase, user.id)
    if (userProfile && userProfile.status === 'active') {
      const redirectUrl = new URL(getRoleBasedRedirect(userProfile.role), request.url)
      return NextResponse.redirect(redirectUrl)
    }
    // If user is pending, let them stay on login page
  }

    return supabaseResponse
  } catch (error) {
    console.error('🚨 [MIDDLEWARE] Unhandled error in middleware:', error)
    // Return a basic NextResponse to prevent middleware failure
    return NextResponse.next({
      request,
    })
  }
}

function getRoleBasedRedirect(role: string): string {
  switch (role) {
    case 'patient': return '/patient'
    case 'assistant': return '/assistant'
    case 'dentist': return '/dentist'
    default: return '/'
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}