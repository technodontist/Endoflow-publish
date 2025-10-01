"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface PatientFormData {
  firstName: string
  lastName: string
  email: string
  phone: string
  dateOfBirth: string
  emergencyContact: string
  insuranceProvider: string
  medicalConditions: string
  allergies: string
}

interface AddPatientFormProps {
  onSubmit: (data: PatientFormData) => void
  onCancel: () => void
}

export function AddPatientForm({ onSubmit, onCancel }: AddPatientFormProps) {
  const [formData, setFormData] = useState<PatientFormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    emergencyContact: "",
    insuranceProvider: "",
    medicalConditions: "",
    allergies: "",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const handleChange = (field: keyof PatientFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name *</Label>
          <Input
            id="firstName"
            value={formData.firstName}
            onChange={(e) => handleChange("firstName", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name *</Label>
          <Input
            id="lastName"
            value={formData.lastName}
            onChange={(e) => handleChange("lastName", e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange("email", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone *</Label>
          <Input
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="dateOfBirth">Date of Birth *</Label>
          <Input
            id="dateOfBirth"
            type="date"
            value={formData.dateOfBirth}
            onChange={(e) => handleChange("dateOfBirth", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="insuranceProvider">Insurance Provider</Label>
          <Select
            value={formData.insuranceProvider}
            onValueChange={(value) => handleChange("insuranceProvider", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select insurance provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="delta-dental">Delta Dental</SelectItem>
              <SelectItem value="cigna">Cigna</SelectItem>
              <SelectItem value="aetna">Aetna</SelectItem>
              <SelectItem value="metlife">MetLife</SelectItem>
              <SelectItem value="humana">Humana</SelectItem>
              <SelectItem value="other">Other</SelectItem>
              <SelectItem value="none">No Insurance</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="emergencyContact">Emergency Contact *</Label>
        <Input
          id="emergencyContact"
          placeholder="Name and phone number"
          value={formData.emergencyContact}
          onChange={(e) => handleChange("emergencyContact", e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="medicalConditions">Medical Conditions</Label>
        <Textarea
          id="medicalConditions"
          placeholder="List any medical conditions (separate with commas)"
          value={formData.medicalConditions}
          onChange={(e) => handleChange("medicalConditions", e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="allergies">Allergies</Label>
        <Textarea
          id="allergies"
          placeholder="List any allergies (separate with commas)"
          value={formData.allergies}
          onChange={(e) => handleChange("allergies", e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Add Patient</Button>
      </div>
    </form>
  )
}
