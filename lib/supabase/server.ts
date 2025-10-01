import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

// TEMPORARY: Service role client to bypass RLS until database fix is applied
export async function createServiceClient() {
  console.log('🔧 [SERVICE CLIENT] Creating service client...')
  console.log('🔧 [SERVICE CLIENT] URL exists:', !!process.env.NEXT_PUBLIC_SUPABASE_URL)
  console.log('🔧 [SERVICE CLIENT] Service key exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)

  // If service role key is not available, fall back to regular client
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('⚠️ [SERVICE CLIENT] Service role key not available, falling back to regular client')
    return createClient()
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return [] },
        setAll() {}
      }
    }
  )
}