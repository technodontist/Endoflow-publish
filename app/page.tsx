"use client"

import { LoginForm } from "@/components/login-form"
import { login } from "@/lib/actions/auth"
import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"

function LoginContent() {
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")
  const searchParams = useSearchParams()

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
              const result = await login(email, password)
              if (result?.error) {
                setError(result.error)
              }
            } catch (err) {
              setError("An unexpected error occurred")
            } finally {
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
