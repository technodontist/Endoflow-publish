'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface AuthGuardProps {
  children: React.ReactNode
  requireAuth?: boolean
  allowedRoles?: string[]
  redirectTo?: string
}

export default function AuthGuard({ 
  children, 
  requireAuth = false, 
  allowedRoles = [], 
  redirectTo = '/' 
}: AuthGuardProps) {
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const router = useRouter()
  const supabase = createClientComponentClient()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (!requireAuth) {
          setAuthorized(true)
          setLoading(false)
          return
        }

        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
          router.push(redirectTo)
          return
        }

        if (allowedRoles.length > 0) {
          // Check user role from profiles table
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, status')
            .eq('id', user.id)
            .single()

          if (!profile || !allowedRoles.includes(profile.role) || profile.status !== 'active') {
            // Redirect based on user role
            const roleRedirects = {
              patient: '/patient',
              assistant: '/assistant', 
              dentist: '/dentist'
            }
            
            if (profile?.role && profile.status === 'active') {
              router.push(roleRedirects[profile.role as keyof typeof roleRedirects] || redirectTo)
            } else {
              router.push(redirectTo)
            }
            return
          }
        }

        setAuthorized(true)
      } catch (error) {
        console.error('Auth check error:', error)
        router.push(redirectTo)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [requireAuth, allowedRoles, redirectTo, router, supabase])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return authorized ? <>{children}</> : null
}