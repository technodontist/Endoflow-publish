"use client"

import { Calendar, Phone, Mail, AlertTriangle, FileText, DollarSign, Edit } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

interface Patient {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  dateOfBirth: string
  lastVisit: string
  nextAppointment?: string
  status: "active" | "inactive" | "new"
  insuranceProvider?: string
  emergencyContact: string
  medicalConditions: string[]
  allergies: string[]
  treatmentHistory: Treatment[]
}

interface Treatment {
  id: string
  date: string
  procedure: string
  dentist: string
  notes: string
  cost: number
}

interface PatientProfileProps {
  patient: Patient
  onEdit?: () => void
  onScheduleAppointment?: () => void
}

export function PatientProfile({ patient, onEdit, onScheduleAppointment }: PatientProfileProps) {
  const calculateAge = (dateOfBirth: string) => {
    const today = new Date()
    const birthDate = new Date(dateOfBirth)
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    return age
  }

  const totalTreatmentCost = patient.treatmentHistory.reduce((sum, treatment) => sum + treatment.cost, 0)

  return (
    <div className="space-y-4">
      {/* Patient Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">
                {patient.firstName} {patient.lastName}
              </CardTitle>
              <CardDescription>Patient ID: {patient.id}</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button size="sm" onClick={onScheduleAppointment}>
                <Calendar className="h-4 w-4 mr-2" />
                Schedule
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                {patient.email}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                {patient.phone}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Age: {calculateAge(patient.dateOfBirth)} ({new Date(patient.dateOfBirth).toLocaleDateString()})
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm">
                <span className="text-muted-foreground">Status: </span>
                <Badge variant="outline" className="ml-1">
                  {patient.status}
                </Badge>
              </div>
              {patient.insuranceProvider && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Insurance: </span>
                  {patient.insuranceProvider}
                </div>
              )}
              <div className="text-sm">
                <span className="text-muted-foreground">Emergency Contact: </span>
                {patient.emergencyContact}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Medical Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Medical Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2">Medical Conditions</h4>
              {patient.medicalConditions.length > 0 ? (
                <div className="space-y-1">
                  {patient.medicalConditions.map((condition, index) => (
                    <Badge key={index} variant="outline" className="mr-2">
                      {condition}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No known medical conditions</p>
              )}
            </div>
            <div>
              <h4 className="font-medium mb-2">Allergies</h4>
              {patient.allergies.length > 0 ? (
                <div className="space-y-1">
                  {patient.allergies.map((allergy, index) => (
                    <Badge key={index} variant="destructive" className="mr-2">
                      {allergy}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No known allergies</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Treatment History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Treatment History
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              Total: ${totalTreatmentCost.toLocaleString()}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {patient.treatmentHistory.length > 0 ? (
            <div className="space-y-4">
              {patient.treatmentHistory.map((treatment, index) => (
                <div key={treatment.id}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{treatment.procedure}</h4>
                        <Badge variant="outline">${treatment.cost}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        {new Date(treatment.date).toLocaleDateString()} • {treatment.dentist}
                      </p>
                      <p className="text-sm">{treatment.notes}</p>
                    </div>
                  </div>
                  {index < patient.treatmentHistory.length - 1 && <Separator className="mt-4" />}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No treatment history available</p>
              <p className="text-sm">Treatment records will appear here after appointments</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Visit Information */}
      <Card>
        <CardHeader>
          <CardTitle>Visit Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">Last Visit</h4>
              {patient.lastVisit ? (
                <p className="text-sm">{new Date(patient.lastVisit).toLocaleDateString()}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No previous visits</p>
              )}
            </div>
            <div>
              <h4 className="font-medium mb-2">Next Appointment</h4>
              {patient.nextAppointment ? (
                <p className="text-sm text-primary font-medium">
                  {new Date(patient.nextAppointment).toLocaleDateString()}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No upcoming appointments</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
