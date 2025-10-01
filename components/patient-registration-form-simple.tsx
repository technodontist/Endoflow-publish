"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { ChevronLeft, ChevronRight, User, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface PatientRegistrationFormProps {
  onSubmit?: (data: PatientRegistrationData) => Promise<void>
  isLoading?: boolean
  error?: string
}

interface PatientRegistrationData {
  firstName: string
  lastName: string
  email: string
  phone: string
  password: string
  confirmPassword: string
  agreeToPrivacy: boolean
}

export function PatientRegistrationForm({
  onSubmit = async () => {},
  isLoading = false,
  error
}: PatientRegistrationFormProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [formData, setFormData] = useState<PatientRegistrationData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    agreeToPrivacy: false,
  })
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const totalSteps = 2

  const validateStep1 = () => {
    const errors: Record<string, string> = {}

    if (!formData.firstName.trim()) {
      errors.firstName = "First name is required"
    }
    if (!formData.lastName.trim()) {
      errors.lastName = "Last name is required"
    }
    if (!formData.email.trim()) {
      errors.email = "Email is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Please enter a valid email address"
    }
    if (!formData.phone.trim()) {
      errors.phone = "Phone number is required"
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const validateStep2 = () => {
    const errors: Record<string, string> = {}

    if (!formData.password.trim()) {
      errors.password = "Password is required"
    } else if (formData.password.length < 8) {
      errors.password = "Password must be at least 8 characters"
    }
    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = "Passwords do not match"
    }
    if (!formData.agreeToPrivacy) {
      errors.agreeToPrivacy = "You must agree to the privacy policy"
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleNext = () => {
    let isValid = false

    switch (currentStep) {
      case 1:
        isValid = validateStep1()
        break
      case 2:
        isValid = validateStep2()
        break
    }

    if (isValid) {
      if (currentStep === totalSteps) {
        handleSubmit()
      } else {
        setCurrentStep(currentStep + 1)
      }
    }
  }

  const handleSubmit = async () => {
    try {
      await onSubmit(formData)
      setIsSubmitted(true)
    } catch (error) {
      console.error('Registration failed:', error)
    }
  }

  if (isSubmitted) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Registration Successful!</h3>
              <p className="text-gray-600 mt-2">
                Please check your email for verification, then wait for admin approval.
                You'll receive a notification once your account is activated.
              </p>
            </div>
            <Button
              onClick={() => window.location.href = '/'}
              className="bg-teal-600 hover:bg-teal-700"
            >
              Go to Login
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="w-full max-w-lg mx-auto space-y-6">
      {/* Progress Indicator */}
      <div className="flex items-center justify-center mb-8">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div key={i} className="flex items-center">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium",
              currentStep > i + 1
                ? "bg-green-600 text-white"
                : currentStep === i + 1
                ? "bg-teal-600 text-white"
                : "bg-gray-200 text-gray-600"
            )}>
              {currentStep > i + 1 ? <CheckCircle className="w-5 h-5" /> : i + 1}
            </div>
            {i < totalSteps - 1 && (
              <div className={cn(
                "w-16 h-1 mx-2",
                currentStep > i + 1 ? "bg-green-600" : "bg-gray-200"
              )} />
            )}
          </div>
        ))}
      </div>

      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center mb-4">
            <User className="w-6 h-6 text-teal-600" />
          </div>
          <CardTitle>
            Patient Registration
          </CardTitle>
          <CardDescription>
            Step {currentStep} of {totalSteps} - Join ENDOFLOW as a patient
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
              {error}
            </div>
          )}

          {/* Step 1: Personal Information */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    className={validationErrors.firstName ? "border-red-500" : ""}
                    placeholder="Enter your first name"
                  />
                  {validationErrors.firstName && (
                    <p className="text-sm text-red-600 mt-1">{validationErrors.firstName}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    className={validationErrors.lastName ? "border-red-500" : ""}
                    placeholder="Enter your last name"
                  />
                  {validationErrors.lastName && (
                    <p className="text-sm text-red-600 mt-1">{validationErrors.lastName}</p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className={validationErrors.email ? "border-red-500" : ""}
                  placeholder="your.email@example.com"
                />
                {validationErrors.email && (
                  <p className="text-sm text-red-600 mt-1">{validationErrors.email}</p>
                )}
              </div>

              <div>
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className={validationErrors.phone ? "border-red-500" : ""}
                  placeholder="+1 (555) 123-4567"
                />
                {validationErrors.phone && (
                  <p className="text-sm text-red-600 mt-1">{validationErrors.phone}</p>
                )}
              </div>

              <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <User className="w-5 h-5 text-teal-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-teal-800">Patient Account Benefits</p>
                    <ul className="mt-2 text-teal-700 space-y-1">
                      <li>• Book and manage appointments online</li>
                      <li>• Access your medical records securely</li>
                      <li>• Communicate with your dental team</li>
                      <li>• Receive appointment reminders</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Account Security */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className={validationErrors.password ? "border-red-500" : ""}
                  placeholder="Minimum 8 characters"
                />
                {validationErrors.password && (
                  <p className="text-sm text-red-600 mt-1">{validationErrors.password}</p>
                )}
              </div>

              <div>
                <Label htmlFor="confirmPassword">Confirm Password *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className={validationErrors.confirmPassword ? "border-red-500" : ""}
                  placeholder="Re-enter your password"
                />
                {validationErrors.confirmPassword && (
                  <p className="text-sm text-red-600 mt-1">{validationErrors.confirmPassword}</p>
                )}
              </div>

              <div className="flex items-start space-x-3">
                <Checkbox
                  id="agreeToPrivacy"
                  checked={formData.agreeToPrivacy}
                  onCheckedChange={(checked) =>
                    setFormData(prev => ({ ...prev, agreeToPrivacy: !!checked }))
                  }
                  className={validationErrors.agreeToPrivacy ? "border-red-500" : ""}
                />
                <div className="text-sm">
                  <label htmlFor="agreeToPrivacy" className="cursor-pointer">
                    I agree to the{" "}
                    <a href="/privacy" className="text-teal-600 underline">
                      Privacy Policy
                    </a>{" "}
                    and{" "}
                    <a href="/terms" className="text-teal-600 underline">
                      Terms of Service
                    </a>
                  </label>
                  {validationErrors.agreeToPrivacy && (
                    <p className="text-red-600 mt-1">{validationErrors.agreeToPrivacy}</p>
                  )}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800">
                  <strong>Account Approval:</strong> Your account will be reviewed by our team before activation.
                  You'll receive an email notification once approved and can then log in to book appointments.
                </p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(currentStep - 1)}
              disabled={currentStep === 1}
              className={currentStep === 1 ? "invisible" : ""}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>

            <Button
              onClick={handleNext}
              disabled={isLoading}
              className="ml-auto bg-teal-600 hover:bg-teal-700"
            >
              {isLoading ? (
                "Creating Account..."
              ) : currentStep === totalSteps ? (
                "Create Patient Account"
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>

          {/* Login Link */}
          <div className="text-center pt-4 border-t">
            <p className="text-sm text-gray-600">
              Already have an account?{" "}
              <a href="/" className="text-teal-600 font-medium hover:underline">
                Sign in here
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}