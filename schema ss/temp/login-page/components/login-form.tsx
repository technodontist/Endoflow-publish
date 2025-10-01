"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface LoginFormProps {
  onLogin?: (email: string, password: string) => Promise<void>
  isLoading?: boolean
  error?: string
  onForgotPassword?: () => void
}

export function LoginForm({ onLogin, isLoading = false, error, onForgotPassword }: LoginFormProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (onLogin && email && password) {
      await onLogin(email, password)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto shadow-lg border-0 bg-card">
      <CardHeader className="space-y-4 text-center pb-6">
        <div className="flex items-center justify-center space-x-4">
          <img
            src="/endoflow-logo.svg"
            alt="Endoflow"
            className="w-16 h-16 object-contain"
          />
          <CardTitle className="text-3xl font-bold text-primary">ENDOFLOW</CardTitle>
        </div>
        <CardDescription className="text-base text-muted-foreground">Clinic Portal</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-foreground">
              Email
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground text-sm">
                @
              </span>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-11 bg-background border-input"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium text-foreground">
              Password
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground text-sm">
                🔒
              </span>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 h-11 bg-background border-input"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full h-11 font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: "#009688",
              color: "white",
              border: "none",
            }}
            onMouseEnter={(e) => {
              if (!isLoading && email && password) {
                e.currentTarget.style.backgroundColor = "#00796b"
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading && email && password) {
                e.currentTarget.style.backgroundColor = "#009688"
              }
            }}
            disabled={isLoading || !email || !password}
          >
            {isLoading ? (
              <>
                <span className="mr-2">⏳</span>
                Signing in...
              </>
            ) : (
              "Login"
            )}
          </button>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
            disabled={isLoading}
          >
            Forgot Password?
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
