"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface AppointmentFormData {
  patientName: string
  patientPhone: string
  patientEmail: string
  procedure: string
  date: string
  startTime: string
  duration: number
  dentist: string
  room: string
  notes: string
}

interface ScheduleAppointmentFormProps {
  onSubmit: (data: AppointmentFormData) => void
  onCancel: () => void
}

export function ScheduleAppointmentForm({ onSubmit, onCancel }: ScheduleAppointmentFormProps) {
  const [formData, setFormData] = useState<AppointmentFormData>({
    patientName: "",
    patientPhone: "",
    patientEmail: "",
    procedure: "",
    date: "",
    startTime: "",
    duration: 60,
    dentist: "",
    room: "",
    notes: "",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const handleChange = (field: keyof AppointmentFormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const procedures = [
    "Routine Cleaning",
    "Dental Examination",
    "Filling",
    "Root Canal",
    "Crown Preparation",
    "Crown Fitting",
    "Tooth Extraction",
    "Teeth Whitening",
    "Consultation",
    "Emergency Visit",
    "Orthodontic Consultation",
    "Periodontal Treatment",
  ]

  const dentists = ["Dr. Johnson", "Dr. Smith", "Dr. Williams", "Dr. Brown"]
  const rooms = ["Room 1", "Room 2", "Room 3", "Room 4"]
  const durations = [30, 45, 60, 90, 120]

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="patientName">Patient Name *</Label>
          <Input
            id="patientName"
            value={formData.patientName}
            onChange={(e) => handleChange("patientName", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="patientPhone">Phone Number *</Label>
          <Input
            id="patientPhone"
            type="tel"
            value={formData.patientPhone}
            onChange={(e) => handleChange("patientPhone", e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="patientEmail">Email Address</Label>
        <Input
          id="patientEmail"
          type="email"
          value={formData.patientEmail}
          onChange={(e) => handleChange("patientEmail", e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="procedure">Procedure *</Label>
        <Select value={formData.procedure} onValueChange={(value) => handleChange("procedure", value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select procedure" />
          </SelectTrigger>
          <SelectContent>
            {procedures.map((procedure) => (
              <SelectItem key={procedure} value={procedure}>
                {procedure}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="date">Date *</Label>
          <Input
            id="date"
            type="date"
            value={formData.date}
            onChange={(e) => handleChange("date", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="startTime">Start Time *</Label>
          <Input
            id="startTime"
            type="time"
            value={formData.startTime}
            onChange={(e) => handleChange("startTime", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="duration">Duration (minutes) *</Label>
          <Select
            value={formData.duration.toString()}
            onValueChange={(value) => handleChange("duration", Number.parseInt(value))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select duration" />
            </SelectTrigger>
            <SelectContent>
              {durations.map((duration) => (
                <SelectItem key={duration} value={duration.toString()}>
                  {duration} minutes
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="dentist">Dentist *</Label>
          <Select value={formData.dentist} onValueChange={(value) => handleChange("dentist", value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select dentist" />
            </SelectTrigger>
            <SelectContent>
              {dentists.map((dentist) => (
                <SelectItem key={dentist} value={dentist}>
                  {dentist}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="room">Room *</Label>
          <Select value={formData.room} onValueChange={(value) => handleChange("room", value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select room" />
            </SelectTrigger>
            <SelectContent>
              {rooms.map((room) => (
                <SelectItem key={room} value={room}>
                  {room}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          placeholder="Additional notes or special instructions..."
          value={formData.notes}
          onChange={(e) => handleChange("notes", e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Schedule Appointment</Button>
      </div>
    </form>
  )
}
