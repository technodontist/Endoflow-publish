'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle, XCircle, Loader2, Copy, Eye, EyeOff } from "lucide-react"
import { manualPatientRegistration } from "@/lib/actions/patient-registration"

export function PatientRegistrationForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [credentials, setCredentials] = useState<{ email: string, password: string } | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [copied, setCopied] = useState(false)
  const [selectedGender, setSelectedGender] = useState<string>('')

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true)
    setNotification(null)

    try {
      const result = await manualPatientRegistration({
        firstName: formData.get('firstName') as string,
        lastName: formData.get('lastName') as string,
        email: formData.get('email') as string,
        phone: formData.get('phone') as string,
        dateOfBirth: formData.get('dateOfBirth') as string,
        gender: selectedGender as 'male' | 'female' | 'other' | 'prefer_not_to_say' | undefined,
        medicalHistory: formData.get('medicalHistory') as string,
        emergencyContact: formData.get('emergencyContact') as string,
        emergencyPhone: formData.get('emergencyPhone') as string,
      })

      if (result.success) {
        setNotification({ type: 'success', message: result.message || 'Patient registered successfully!' })
        // Store credentials for display
        setCredentials({
          email: result.email || '',
          password: result.temporaryPassword || ''
        })
        // Reset form
        const form = document.getElementById('patient-registration-form') as HTMLFormElement
        form?.reset()
        setSelectedGender('')
      } else {
        setNotification({ type: 'error', message: result.error || 'Registration failed' })
        setCredentials(null)
      }
    } catch (error) {
      console.error('Error submitting form:', error)
      setNotification({ type: 'error', message: 'An unexpected error occurred' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const copyCredentials = async () => {
    if (!credentials) return

    const credentialsText = `Patient Login Credentials:
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

      {/* Login Credentials Display */}
      {credentials && (
        <Card className="border-l-4 border-l-blue-500 bg-blue-50">
          <CardContent className="pt-4">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-blue-800">Patient Login Credentials</h3>
              </div>

              <div className="bg-white p-4 rounded-lg border border-blue-200 space-y-3">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Email Address</Label>
                  <div className="mt-1 p-2 bg-gray-50 rounded border text-sm font-mono">
                    {credentials.email}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700">Temporary Password</Label>
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

      {/* Registration Form */}
      <form id="patient-registration-form" action={handleSubmit} className="space-y-6">
        {/* Personal Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b pb-2">Personal Information</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                name="firstName"
                type="text"
                required
                placeholder="Enter first name"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                name="lastName"
                type="text"
                required
                placeholder="Enter last name"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="patient@example.com"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                required
                placeholder="+1 (555) 123-4567"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of Birth</Label>
              <Input
                id="dateOfBirth"
                name="dateOfBirth"
                type="date"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select value={selectedGender} onValueChange={setSelectedGender} disabled={isSubmitting}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                  <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Optional - Helps us provide appropriate care
              </p>
            </div>
          </div>
        </div>

        {/* Medical Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b pb-2">Medical Information</h3>

          <div className="space-y-2">
            <Label htmlFor="medicalHistory">Medical History Summary</Label>
            <Textarea
              id="medicalHistory"
              name="medicalHistory"
              placeholder="Brief summary of relevant medical history, allergies, medications, etc."
              className="min-h-[100px]"
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b pb-2">Emergency Contact</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="emergencyContact">Emergency Contact Name</Label>
              <Input
                id="emergencyContact"
                name="emergencyContact"
                type="text"
                placeholder="Contact person name"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emergencyPhone">Emergency Contact Phone</Label>
              <Input
                id="emergencyPhone"
                name="emergencyPhone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <Button
            type="submit"
            className="w-full md:w-auto bg-teal-600 hover:bg-teal-700"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Registering Patient...
              </>
            ) : (
              'Register Patient'
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}