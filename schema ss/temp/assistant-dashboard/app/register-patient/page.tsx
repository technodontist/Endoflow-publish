"use client"

import type React from "react"

import { useState } from "react"
import { Header } from "@/components/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

export default function RegisterPatientPage() {
  const [formData, setFormData] = useState({
    uhid: "",
    firstName: "",
    lastName: "",
    dateOfBirth: undefined as Date | undefined,
    phoneNumber: "",
    email: "",
    medicalHistory: "",
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleDateSelect = (date: Date | undefined) => {
    setFormData((prev) => ({ ...prev, dateOfBirth: date }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("[v0] Form submitted:", formData)
    // Handle form submission logic here
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="shadow-lg">
            <CardHeader className="bg-[#005A9C] text-white rounded-t-lg">
              <CardTitle className="text-2xl font-semibold text-center">Register New Patient</CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* UHID Field */}
                <div className="space-y-2">
                  <Label htmlFor="uhid" className="text-[#005A9C] font-medium">
                    UHID (Unique Health ID)
                  </Label>
                  <Input
                    id="uhid"
                    type="text"
                    placeholder="Enter UHID"
                    value={formData.uhid}
                    onChange={(e) => handleInputChange("uhid", e.target.value)}
                    className="border-gray-300 focus:border-[#009688] focus:ring-[#009688]"
                    required
                  />
                </div>

                {/* Name Fields Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-[#005A9C] font-medium">
                      First Name
                    </Label>
                    <Input
                      id="firstName"
                      type="text"
                      placeholder="Enter first name"
                      value={formData.firstName}
                      onChange={(e) => handleInputChange("firstName", e.target.value)}
                      className="border-gray-300 focus:border-[#009688] focus:ring-[#009688]"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-[#005A9C] font-medium">
                      Last Name
                    </Label>
                    <Input
                      id="lastName"
                      type="text"
                      placeholder="Enter last name"
                      value={formData.lastName}
                      onChange={(e) => handleInputChange("lastName", e.target.value)}
                      className="border-gray-300 focus:border-[#009688] focus:ring-[#009688]"
                      required
                    />
                  </div>
                </div>

                {/* Date of Birth */}
                <div className="space-y-2">
                  <Label className="text-[#005A9C] font-medium">Date of Birth</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal border-gray-300 hover:border-[#009688]",
                          !formData.dateOfBirth && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.dateOfBirth ? format(formData.dateOfBirth, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.dateOfBirth}
                        onSelect={handleDateSelect}
                        disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Contact Information Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber" className="text-[#005A9C] font-medium">
                      Phone Number
                    </Label>
                    <Input
                      id="phoneNumber"
                      type="tel"
                      placeholder="Enter phone number"
                      value={formData.phoneNumber}
                      onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
                      className="border-gray-300 focus:border-[#009688] focus:ring-[#009688]"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-[#005A9C] font-medium">
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter email address"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      className="border-gray-300 focus:border-[#009688] focus:ring-[#009688]"
                      required
                    />
                  </div>
                </div>

                {/* Medical History */}
                <div className="space-y-2">
                  <Label htmlFor="medicalHistory" className="text-[#005A9C] font-medium">
                    Medical History Summary
                  </Label>
                  <Textarea
                    id="medicalHistory"
                    placeholder="Enter relevant medical history, allergies, current medications, etc."
                    value={formData.medicalHistory}
                    onChange={(e) => handleInputChange("medicalHistory", e.target.value)}
                    className="border-gray-300 focus:border-[#009688] focus:ring-[#009688] min-h-[120px] resize-none"
                    rows={5}
                  />
                </div>

                {/* Submit Button */}
                <div className="pt-4">
                  <Button
                    type="submit"
                    className="w-full bg-[#009688] hover:bg-[#00796B] text-white font-semibold py-3 text-lg transition-colors duration-200"
                  >
                    Save Patient
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}