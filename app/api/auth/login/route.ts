import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

/**
 * POST /api/auth/login
 *
 * Route Handler for login — avoids the cookies() deadlock that occurs
 * when using server actions with @supabase/ssr in Next.js 15.
 *
 * Uses the standard Supabase SSR client (createClient) which works fine
 * in Route Handlers — the deadlock only affects Server Actions.
 */
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    console.log('🚀 [LOGIN API] Authenticating:', email)

    // Use standard Supabase SSR client — cookies() works fine in Route Handlers
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      console.error('🚨 [LOGIN API] Auth failed:', error.message)
      return NextResponse.json({ error: error.message })
    }

    if (!data.user) {
      return NextResponse.json({ error: 'Authentication failed - no user data returned' })
    }

    console.log('✅ [LOGIN API] Auth successful. User:', data.user.id)

    // Look up profile for role-based redirect
    const serviceSupabase = await createServiceClient()
    const { data: profile, error: profileError } = await serviceSupabase
      .from('profiles')
      .select('role, status')
      .eq('id', data.user.id)
      .single()

    if (profileError || !profile) {
      console.error('🚨 [LOGIN API] No profile found for user')
      return NextResponse.json({ error: 'User not found in system. Please contact support.' })
    }

    if (profile.status === 'pending') {
      return NextResponse.json({ error: 'Your account is pending approval. Please wait for an administrator to verify your account.' })
    }

    if (profile.status !== 'active') {
      return NextResponse.json({ error: 'Your account is not active. Please contact support.' })
    }

    // Return redirect path based on role
    const roleRoutes: Record<string, string> = {
      patient: '/patient',
      assistant: '/assistant',
      dentist: '/dentist',
    }
    const redirectPath = roleRoutes[profile.role] || '/patient'

    console.log('✅ [LOGIN API] Login complete. Role:', profile.role, '→', redirectPath)
    return NextResponse.json({ redirect: redirectPath })

  } catch (err: any) {
    console.error('🚨 [LOGIN API] Exception:', err)
    return NextResponse.json({ error: 'An unexpected error occurred. Please try again.' }, { status: 500 })
  }
}
