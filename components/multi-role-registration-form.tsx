"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { ChevronLeft, ChevronRight, User, Mail, Phone, FileText, CheckCircle, Stethoscope, UserCheck, Users } from "lucide-react"
import { cn } from "@/lib/utils"

interface MultiRoleRegistrationFormProps {
  onSubmit?: (data: MultiRoleRegistrationData) => Promise<void>
  isLoading?: boolean
  error?: string
}

interface MultiRoleRegistrationData {
  // Basic info (all roles)
  firstName: string
  lastName: string
  email: string
  phone: string
  password: string
  confirmPassword: string
  role: 'patient' | 'assistant' | 'dentist'

  // Role-specific fields
  specialty?: string // For dentists
  licenseNumber?: string // For dentists
  experience?: string // For assistants/dentists

  // Agreement
  agreeToPrivacy: boolean
}

export function MultiRoleRegistrationForm({
  onSubmit = async () => {},
  isLoading = false,
  error
}: MultiRoleRegistrationFormProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [formData, setFormData] = useState<MultiRoleRegistrationData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: 'patient',
    specialty: "",
    licenseNumber: "",
    experience: "",
    agreeToPrivacy: false,
  })
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const totalSteps = 4 // Added role selection step

  const roleOptions = [
    {
      value: 'patient',
      label: 'Patient',
      icon: User,
      description: 'Book appointments and manage your dental health',
      color: 'text-blue-600'
    },
    {
      value: 'assistant',
      label: 'Dental Assistant',
      icon: UserCheck,
      description: 'Manage patient workflows and assist dentists',
      color: 'text-green-600'
    },
    {
      value: 'dentist',
      label: 'Dentist',
      icon: Stethoscope,
      description: 'Provide dental care and manage practice',
      color: 'text-purple-600'
    }
  ]

  const validateStep1 = () => {
    const errors: Record<string, string> = {}

    if (!formData.role) {
      errors.role = "Please select your role"
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const validateStep2 = () => {
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

  const validateStep3 = () => {
    const errors: Record<string, string> = {}

    // Role-specific validation
    if (formData.role === 'dentist') {
      if (!formData.specialty?.trim()) {
        errors.specialty = "Specialty is required for dentists"
      }
      if (!formData.licenseNumber?.trim()) {
        errors.licenseNumber = "License number is required for dentists"
      }
    }

    if ((formData.role === 'assistant' || formData.role === 'dentist') && !formData.experience?.trim()) {
      errors.experience = "Experience description is required"
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const validateStep4 = () => {
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
      case 3:
        isValid = validateStep3()
        break
      case 4:
        isValid = validateStep4()
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
                {formData.role === 'patient'
                  ? 'Please check your email for verification, then wait for admin approval.'
                  : `Your ${formData.role} application has been submitted for review. You'll receive an email notification once approved.`
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Progress Indicator */}
      <div className="flex items-center justify-between mb-8">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div key={i} className="flex items-center">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium",
              currentStep > i + 1
                ? "bg-green-600 text-white"
                : currentStep === i + 1
                ? "bg-blue-600 text-white"
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
        <CardHeader>
          <CardTitle className="text-center">
            {currentStep === 1 && "Select Your Role"}
            {currentStep === 2 && "Personal Information"}
            {currentStep === 3 && "Professional Details"}
            {currentStep === 4 && "Account Security"}
          </CardTitle>
          <CardDescription className="text-center">
            Step {currentStep} of {totalSteps}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
              {error}
            </div>
          )}

          {/* Step 1: Role Selection */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <Label className="text-base font-medium">I am registering as a:</Label>
              <div className="grid gap-4">
                {roleOptions.map((option) => {
                  const Icon = option.icon
                  return (
                    <div
                      key={option.value}
                      className={cn(
                        "border rounded-lg p-4 cursor-pointer transition-all hover:border-blue-300",
                        formData.role === option.value
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200"
                      )}
                      onClick={() => setFormData(prev => ({ ...prev, role: option.value as any }))}
                    >
                      <div className="flex items-start space-x-3">
                        <Icon className={cn("w-6 h-6 mt-1", option.color)} />
                        <div className="flex-1">
                          <div className="font-medium">{option.label}</div>
                          <div className="text-sm text-gray-600 mt-1">{option.description}</div>
                        </div>
                        <div className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                          formData.role === option.value
                            ? "border-blue-500 bg-blue-500"
                            : "border-gray-300"
                        )}>
                          {formData.role === option.value && (
                            <div className="w-2 h-2 rounded-full bg-white" />
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              {validationErrors.role && (
                <p className="text-sm text-red-600">{validationErrors.role}</p>
              )}
            </div>
          )}

          {/* Step 2: Personal Information */}
          {currentStep === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                  className={validationErrors.firstName ? "border-red-500" : ""}
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
                />
                {validationErrors.lastName && (
                  <p className="text-sm text-red-600 mt-1">{validationErrors.lastName}</p>
                )}
              </div>

              <div>
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className={validationErrors.email ? "border-red-500" : ""}
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
                />
                {validationErrors.phone && (
                  <p className="text-sm text-red-600 mt-1">{validationErrors.phone}</p>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Professional Details */}
          {currentStep === 3 && (
            <div className="space-y-4">
              {formData.role === 'dentist' && (
                <>
                  <div>
                    <Label htmlFor="specialty">Specialty *</Label>
                    <Select
                      value={formData.specialty}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, specialty: value }))}
                    >
                      <SelectTrigger className={validationErrors.specialty ? "border-red-500" : ""}>
                        <SelectValue placeholder="Select your specialty" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General Dentistry</SelectItem>
                        <SelectItem value="orthodontics">Orthodontics</SelectItem>
                        <SelectItem value="endodontics">Endodontics</SelectItem>
                        <SelectItem value="periodontics">Periodontics</SelectItem>
                        <SelectItem value="oral-surgery">Oral Surgery</SelectItem>
                        <SelectItem value="prosthodontics">Prosthodontics</SelectItem>
                        <SelectItem value="pediatric">Pediatric Dentistry</SelectItem>
                      </SelectContent>
                    </Select>
                    {validationErrors.specialty && (
                      <p className="text-sm text-red-600 mt-1">{validationErrors.specialty}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="licenseNumber">License Number *</Label>
                    <Input
                      id="licenseNumber"
                      value={formData.licenseNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, licenseNumber: e.target.value }))}
                      className={validationErrors.licenseNumber ? "border-red-500" : ""}
                      placeholder="Enter your dental license number"
                    />
                    {validationErrors.licenseNumber && (
                      <p className="text-sm text-red-600 mt-1">{validationErrors.licenseNumber}</p>
                    )}
                  </div>
                </>
              )}

              {(formData.role === 'assistant' || formData.role === 'dentist') && (
                <div>
                  <Label htmlFor="experience">
                    {formData.role === 'dentist' ? 'Professional Experience *' : 'Experience & Qualifications *'}
                  </Label>
                  <Textarea
                    id="experience"
                    value={formData.experience}
                    onChange={(e) => setFormData(prev => ({ ...prev, experience: e.target.value }))}
                    className={validationErrors.experience ? "border-red-500" : ""}
                    placeholder={
                      formData.role === 'dentist'
                        ? "Describe your professional background, education, and years of practice..."
                        : "Describe your experience, certifications, and qualifications as a dental assistant..."
                    }
                    rows={4}
                  />
                  {validationErrors.experience && (
                    <p className="text-sm text-red-600 mt-1">{validationErrors.experience}</p>
                  )}
                </div>
              )}

              {formData.role === 'patient' && (
                <div className="text-center py-8">
                  <User className="w-16 h-16 mx-auto mb-4 text-blue-600" />
                  <h3 className="text-lg font-semibold mb-2">Ready to Set Up Your Account</h3>
                  <p className="text-gray-600">
                    As a patient, you'll have access to appointment booking,
                    medical records, and communication with your dental team.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Account Security */}
          {currentStep === 4 && (
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
                    <a href="/privacy" className="text-blue-600 underline">
                      Privacy Policy
                    </a>{" "}
                    and{" "}
                    <a href="/terms" className="text-blue-600 underline">
                      Terms of Service
                    </a>
                  </label>
                  {validationErrors.agreeToPrivacy && (
                    <p className="text-red-600 mt-1">{validationErrors.agreeToPrivacy}</p>
                  )}
                </div>
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
              className="ml-auto"
            >
              {isLoading ? (
                "Processing..."
              ) : currentStep === totalSteps ? (
                "Create Account"
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}