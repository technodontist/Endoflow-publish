'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, XCircle, Loader2, Copy, Eye, EyeOff, Key, Mail } from "lucide-react"
import { generateNewPassword, sendPasswordResetEmail } from "@/lib/actions/password-management"

export function PasswordManagement() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [credentials, setCredentials] = useState<{ email: string, password: string } | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleGeneratePassword(formData: FormData) {
    setIsGenerating(true)
    setNotification(null)
    setCredentials(null)

    try {
      const email = formData.get('email') as string
      const result = await generateNewPassword(email)

      if (result.success) {
        setNotification({ type: 'success', message: result.message || 'Password reset successfully!' })
        setCredentials({
          email: result.email || '',
          password: result.temporaryPassword || ''
        })
      } else {
        setNotification({ type: 'error', message: result.error || 'Password reset failed' })
        setCredentials(null)
      }
    } catch (error) {
      console.error('Error generating password:', error)
      setNotification({ type: 'error', message: 'An unexpected error occurred' })
      setCredentials(null)
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleSendResetEmail(formData: FormData) {
    setIsSendingEmail(true)
    setNotification(null)

    try {
      const email = formData.get('resetEmail') as string
      const result = await sendPasswordResetEmail(email)

      if (result.success) {
        setNotification({ type: 'success', message: result.message || 'Reset email sent successfully!' })
      } else {
        setNotification({ type: 'error', message: result.error || 'Failed to send reset email' })
      }
    } catch (error) {
      console.error('Error sending reset email:', error)
      setNotification({ type: 'error', message: 'An unexpected error occurred' })
    } finally {
      setIsSendingEmail(false)
    }
  }

  const copyCredentials = async () => {
    if (!credentials) return

    const credentialsText = `New Patient Login Credentials:
Email: ${credentials.email}
Password: ${credentials.password}

Please share these credentials securely with the patient.
The patient should change their password after first login.`

    try {
      await navigator.clipboard.writeText(credentialsText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy credentials:', err)
    }
  }

  return (
    <div className="space-y-6">
      {/* Notification */}
      {notification && (
        <Card className={`border-l-4 ${
          notification.type === 'success'
            ? 'border-l-green-500 bg-green-50'
            : 'border-l-red-500 bg-red-50'
        }`}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              {notification.type === 'success' ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              <p className={`text-sm font-medium ${
                notification.type === 'success' ? 'text-green-800' : 'text-red-800'
              }`}>
                {notification.message}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* New Password Display */}
      {credentials && (
        <Card className="border-l-4 border-l-blue-500 bg-blue-50">
          <CardContent className="pt-4">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Key className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-blue-800">New Login Credentials</h3>
              </div>

              <div className="bg-white p-4 rounded-lg border border-blue-200 space-y-3">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Email Address</Label>
                  <div className="mt-1 p-2 bg-gray-50 rounded border text-sm font-mono">
                    {credentials.email}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700">New Temporary Password</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex-1 p-2 bg-gray-50 rounded border text-sm font-mono">
                      {showPassword ? credentials.password : '••••••••••••••••'}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPassword(!showPassword)}
                      className="px-3"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="button"
                  onClick={copyCredentials}
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={copied}
                >
                  {copied ? (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy Credentials
                    </>
                  )}
                </Button>
                <p className="text-sm text-blue-700">
                  Share these credentials securely with the patient
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800">
                  <strong>Important:</strong> The patient should change their password after first login for security.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Generate New Password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Generate New Password
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={handleGeneratePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Patient Email Address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="patient@example.com"
                  disabled={isGenerating}
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-teal-600 hover:bg-teal-700"
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Key className="mr-2 h-4 w-4" />
                    Generate New Password
                  </>
                )}
              </Button>

              <p className="text-xs text-gray-600">
                This will immediately update the patient's password and generate new temporary credentials.
              </p>
            </form>
          </CardContent>
        </Card>

        {/* Send Password Reset Email */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Send Reset Email
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={handleSendResetEmail} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="resetEmail">Patient Email Address</Label>
                <Input
                  id="resetEmail"
                  name="resetEmail"
                  type="email"
                  required
                  placeholder="patient@example.com"
                  disabled={isSendingEmail}
                />
              </div>

              <Button
                type="submit"
                variant="outline"
                className="w-full"
                disabled={isSendingEmail}
              >
                {isSendingEmail ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Reset Email
                  </>
                )}
              </Button>

              <p className="text-xs text-gray-600">
                This will send a password reset link to the patient's email address for self-service reset.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}