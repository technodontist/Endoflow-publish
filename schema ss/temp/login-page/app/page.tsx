"use client"

import { LoginForm } from "@/components/ui/login-form"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <LoginForm
          onLogin={async (email, password) => {
            console.log("Login attempt:", { email, password })
            // Simulate login success and redirect to registration
            router.push("/register")
          }}
          onForgotPassword={() => {
            // TODO: Implement forgot password logic
            console.log("Forgot password clicked")
          }}
        />
      </div>
    </div>
  )
}
