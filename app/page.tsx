"use client"

import { LoginForm } from "@/components/login-form"
import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"

function LoginContent() {
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const status = searchParams.get('status')
    if (status === 'pending') {
      setStatusMessage('Your account is pending approval. Please wait for an administrator to verify your account.')
    }
  }, [searchParams])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {statusMessage && (
          <div className="mb-4 p-3 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-md">
            {statusMessage}
          </div>
        )}
        <LoginForm
          onLogin={async (email, password) => {
            setIsLoading(true)
            setError("")
            setStatusMessage("")
            try {
              const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
              })
              const result = await res.json()
              if (result?.error) {
                setError(result.error)
                setIsLoading(false)
              } else if (result?.redirect) {
                // Full page navigation — router.push uses RSC which can stall
                // on large pages like /dentist. window.location ensures clean load.
                window.location.href = result.redirect
              }
            } catch (err: any) {
              setError("An unexpected error occurred")
              setIsLoading(false)
            }
          }}
          onForgotPassword={() => {
            // TODO: Implement forgot password logic
            console.log("Forgot password clicked")
          }}
          error={error}
          isLoading={isLoading}
        />
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
