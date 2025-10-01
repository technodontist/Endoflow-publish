"use client"

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LogoutPage() {
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(true)

  useEffect(() => {
    const handleLogout = async () => {
      try {
        const supabase = createClient()
        await supabase.auth.signOut()
        console.log('✅ [LOGOUT] User logged out successfully')
        router.push('/')
        router.refresh()
      } catch (error) {
        console.error('❌ [LOGOUT] Error logging out:', error)
        router.push('/')
      } finally {
        setIsLoggingOut(false)
      }
    }

    handleLogout()
  }, [router])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        {isLoggingOut ? (
          <div className="space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">Logging out...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-muted-foreground">Redirecting to login...</p>
          </div>
        )}
      </div>
    </div>
  )
}