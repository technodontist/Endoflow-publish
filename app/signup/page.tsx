"use client"

import { PatientRegistrationForm } from "@/components/patient-registration-form-simple"
import { patientSignup } from "@/lib/actions/patient-signup"
import { useState } from "react"
import { EndoflowLogo } from "@/components/ui/endoflow-logo"

export default function SignupPage() {
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <EndoflowLogo size="2xl" showText={false} />
            <h1 className="text-3xl font-bold text-gray-900">ENDOFLOW</h1>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Join ENDOFLOW</h2>
          <p className="text-gray-600">
            Create your patient account to book appointments and manage your dental health
          </p>
          <div className="mt-4">
            <div className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-teal-100 text-teal-800">
              Patient Registration Only
            </div>
          </div>
        </div>

        <PatientRegistrationForm
          onSubmit={async (data) => {
            setIsLoading(true)
            setError("")
            try {
              const result = await patientSignup({
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
                phone: data.phone,
                dateOfBirth: data.dateOfBirth,
                password: data.password,
              })

              if (result?.error) {
                setError(result.error)
              }
              // If successful, the component will show success state
            } catch (err) {
              console.error('Signup error:', err)
              setError("An unexpected error occurred during registration")
            } finally {
              setIsLoading(false)
            }
          }}
          error={error}
          isLoading={isLoading}
        />

        <div className="mt-8 text-center">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>For Dental Staff:</strong> Dentists and assistants are added by administrators through the Supabase Dashboard.
              Contact your system administrator for access.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}