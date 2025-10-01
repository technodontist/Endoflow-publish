"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { ChevronLeft, ChevronRight, User, Mail, Phone, FileText, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface RegistrationFormProps {
  onSubmit?: (data: RegistrationData) => Promise<void>
  isLoading?: boolean
  error?: string
}

interface RegistrationData {
  firstName: string
  lastName: string
  email: string
  phone: string
  agreeToPrivacy: boolean
}

export function RegistrationForm({ onSubmit = async () => {}, isLoading = false, error }: RegistrationFormProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [formData, setFormData] = useState<RegistrationData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
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
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = "Please enter a valid email"
    }
    if (!formData.phone.trim()) {
      errors.phone = "Phone number is required"
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const validateStep2 = () => {
    const errors: Record<string, string> = {}

    if (!formData.agreeToPrivacy) {
      errors.agreeToPrivacy = "You must agree to the privacy policy"
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleNext = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
      setValidationErrors({})
    }
  }

  const handleSubmit = async () => {
    if (validateStep2()) {
      await onSubmit(formData)
      setIsSubmitted(true)
    }
  }

  const updateFormData = (field: keyof RegistrationData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (validationErrors[field]) {
      setValidationErrors((prev) => ({ ...prev, [field]: "" }))
    }
  }

  if (isSubmitted) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <Card className="w-full max-w-md shadow-xl border-0 bg-card">
          <CardContent className="p-8 text-center space-y-6">
            <div className="flex justify-center">
              <CheckCircle className="h-16 w-16 text-accent" />
            </div>
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-primary">Welcome to the ENDOFLOW family!</h2>
              <div className="space-y-3 text-muted-foreground">
                <p>Thank you, your information has been securely submitted.</p>
                <p>Please let our front desk team know you've completed your registration.</p>
                <p>Dr. Nisarg and team are looking forward to taking care of you.</p>
              </div>
            </div>
            <Button
              onClick={() => setIsSubmitted(false)}
              className="bg-accent hover:bg-accent/90 text-accent-foreground w-full"
            >
              Close
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <Card className="w-full shadow-lg border-0 bg-card">
      <CardHeader className="text-center space-y-2 pb-6">
        <CardTitle className="text-2xl font-semibold text-primary">Welcome! Please Register</CardTitle>
        <CardDescription className="text-muted-foreground">
          New patient registration for ENDOFLOW Clinic
        </CardDescription>

        {/* Progress indicator */}
        <div className="flex items-center justify-center space-x-2 pt-4">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div
              key={i}
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                i + 1 <= currentStep ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {i + 1}
            </div>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
            {error}
          </div>
        )}

        {/* Step 1: Personal Details */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <User className="h-5 w-5 text-accent" />
              <h3 className="text-lg font-medium text-foreground">Personal Details</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="Enter first name"
                  value={formData.firstName}
                  onChange={(e) => updateFormData("firstName", e.target.value)}
                  className={cn(validationErrors.firstName && "border-destructive")}
                />
                {validationErrors.firstName && <p className="text-sm text-destructive">{validationErrors.firstName}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Enter last name"
                  value={formData.lastName}
                  onChange={(e) => updateFormData("lastName", e.target.value)}
                  className={cn(validationErrors.lastName && "border-destructive")}
                />
                {validationErrors.lastName && <p className="text-sm text-destructive">{validationErrors.lastName}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter email address"
                  value={formData.email}
                  onChange={(e) => updateFormData("email", e.target.value)}
                  className={cn("pl-10", validationErrors.email && "border-destructive")}
                />
              </div>
              {validationErrors.email && <p className="text-sm text-destructive">{validationErrors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="Enter phone number"
                  value={formData.phone}
                  onChange={(e) => updateFormData("phone", e.target.value)}
                  className={cn("pl-10", validationErrors.phone && "border-destructive")}
                />
              </div>
              {validationErrors.phone && <p className="text-sm text-destructive">{validationErrors.phone}</p>}
            </div>
          </div>
        )}

        {/* Step 2: Privacy Policy & Submit */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="flex items-center space-x-2 mb-4">
              <FileText className="h-5 w-5 text-accent" />
              <h3 className="text-lg font-medium text-foreground">Privacy & Terms</h3>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
              <h4 className="font-medium text-foreground">Registration Summary</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  <span className="font-medium">Name:</span> {formData.firstName} {formData.lastName}
                </p>
                <p>
                  <span className="font-medium">Email:</span> {formData.email}
                </p>
                <p>
                  <span className="font-medium">Phone:</span> {formData.phone}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="privacy"
                  checked={formData.agreeToPrivacy}
                  onCheckedChange={(checked) => updateFormData("agreeToPrivacy", !!checked)}
                  className={cn(validationErrors.agreeToPrivacy && "border-destructive")}
                />
                <div className="space-y-1">
                  <Label htmlFor="privacy" className="text-sm leading-relaxed cursor-pointer">
                    I agree to the{" "}
                    <button
                      type="button"
                      className="text-accent hover:underline font-medium"
                      onClick={() => {
                        /* Handle privacy policy modal */
                      }}
                    >
                      privacy policy
                    </button>{" "}
                    and terms of service *
                  </Label>
                  {validationErrors.agreeToPrivacy && (
                    <p className="text-sm text-destructive">{validationErrors.agreeToPrivacy}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-4">
          {currentStep > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              className="flex items-center space-x-2 bg-transparent"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>
          ) : (
            <div />
          )}

          {currentStep < totalSteps ? (
            <Button
              type="button"
              onClick={handleNext}
              className="bg-accent hover:bg-accent/90 text-accent-foreground flex items-center space-x-2"
            >
              <span>Next</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading}
              className="bg-accent hover:bg-accent/90 text-accent-foreground min-w-[140px]"
            >
              {isLoading ? "Submitting..." : "Submit Registration"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
