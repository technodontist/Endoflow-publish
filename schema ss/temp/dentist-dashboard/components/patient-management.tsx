"use client"

import { useState } from "react"
import { Search, Plus, Filter, Phone, Mail, Calendar, FileText, Edit, Eye } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { PatientProfile } from "@/components/patient-profile"
import { AddPatientForm } from "@/components/add-patient-form"

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

interface PatientManagementProps {
  patients?: Patient[]
  onPatientSelect?: (patient: Patient) => void
  onAddPatient?: (patient: Partial<Patient>) => void
  onEditPatient?: (patient: Patient) => void
}

export function PatientManagement({
  patients = [
    {
      id: "1",
      firstName: "John",
      lastName: "Smith",
      email: "john.smith@email.com",
      phone: "(555) 123-4567",
      dateOfBirth: "1985-03-15",
      lastVisit: "2024-01-15",
      nextAppointment: "2024-02-15",
      status: "active",
      insuranceProvider: "Delta Dental",
      emergencyContact: "Jane Smith - (555) 123-4568",
      medicalConditions: ["Hypertension"],
      allergies: ["Penicillin"],
      treatmentHistory: [
        {
          id: "t1",
          date: "2024-01-15",
          procedure: "Routine Cleaning",
          dentist: "Dr. Johnson",
          notes: "Good oral health, minor plaque buildup",
          cost: 150,
        },
      ],
    },
    {
      id: "2",
      firstName: "Sarah",
      lastName: "Johnson",
      email: "sarah.johnson@email.com",
      phone: "(555) 234-5678",
      dateOfBirth: "1990-07-22",
      lastVisit: "2024-01-20",
      status: "active",
      insuranceProvider: "Cigna",
      emergencyContact: "Mike Johnson - (555) 234-5679",
      medicalConditions: [],
      allergies: ["Latex"],
      treatmentHistory: [
        {
          id: "t2",
          date: "2024-01-20",
          procedure: "Root Canal - Session 1",
          dentist: "Dr. Smith",
          notes: "Started root canal treatment on tooth #14",
          cost: 800,
        },
      ],
    },
    {
      id: "3",
      firstName: "Michael",
      lastName: "Brown",
      email: "michael.brown@email.com",
      phone: "(555) 345-6789",
      dateOfBirth: "1978-11-08",
      lastVisit: "2023-12-10",
      nextAppointment: "2024-02-10",
      status: "active",
      emergencyContact: "Lisa Brown - (555) 345-6790",
      medicalConditions: ["Diabetes Type 2"],
      allergies: [],
      treatmentHistory: [
        {
          id: "t3",
          date: "2023-12-10",
          procedure: "Crown Preparation",
          dentist: "Dr. Johnson",
          notes: "Prepared tooth for crown placement",
          cost: 600,
        },
      ],
    },
    {
      id: "4",
      firstName: "Emily",
      lastName: "Davis",
      email: "emily.davis@email.com",
      phone: "(555) 456-7890",
      dateOfBirth: "1995-05-30",
      lastVisit: "",
      status: "new",
      emergencyContact: "Tom Davis - (555) 456-7891",
      medicalConditions: [],
      allergies: [],
      treatmentHistory: [],
    },
  ],
  onPatientSelect,
  onAddPatient,
  onEditPatient,
}: PatientManagementProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [showAddPatient, setShowAddPatient] = useState(false)

  const filteredPatients = patients.filter((patient) => {
    const matchesSearch =
      `${patient.firstName} ${patient.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.phone.includes(searchTerm)

    const matchesStatus = statusFilter === "all" || patient.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 border-green-200"
      case "inactive":
        return "bg-gray-100 text-gray-800 border-gray-200"
      case "new":
        return "bg-blue-100 text-blue-800 border-blue-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const handlePatientClick = (patient: Patient) => {
    setSelectedPatient(patient)
    onPatientSelect?.(patient)
  }

  const handleAddPatient = (patientData: Partial<Patient>) => {
    onAddPatient?.(patientData)
    setShowAddPatient(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Patient Management</h2>
          <p className="text-muted-foreground">Manage patient records and information</p>
        </div>
        <Dialog open={showAddPatient} onOpenChange={setShowAddPatient}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add New Patient
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Patient</DialogTitle>
              <DialogDescription>Enter the patient's information to create a new record.</DialogDescription>
            </DialogHeader>
            <AddPatientForm onSubmit={handleAddPatient} onCancel={() => setShowAddPatient(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search patients by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Patients</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="new">New Patients</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Patient List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Patient List ({filteredPatients.length})</CardTitle>
            <CardDescription>Click on a patient to view their profile</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {filteredPatients.map((patient) => (
                <div
                  key={patient.id}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => handlePatientClick(patient)}
                >
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">
                        {patient.firstName} {patient.lastName}
                      </h3>
                      <Badge className={getStatusColor(patient.status)} variant="outline">
                        {patient.status}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3" />
                        {patient.email}
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3" />
                        {patient.phone}
                      </div>
                      {patient.lastVisit && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          Last visit: {new Date(patient.lastVisit).toLocaleDateString()}
                        </div>
                      )}
                      {patient.nextAppointment && (
                        <div className="flex items-center gap-2 text-primary">
                          <Calendar className="h-3 w-3" />
                          Next: {new Date(patient.nextAppointment).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 ml-4">
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onEditPatient?.(patient)
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {filteredPatients.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No patients found matching your criteria</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Patient Profile */}
        <div>
          {selectedPatient ? (
            <PatientProfile patient={selectedPatient} onEdit={() => onEditPatient?.(selectedPatient)} />
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-[600px]">
                <div className="text-center text-muted-foreground">
                  <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Select a patient</p>
                  <p className="text-sm">Choose a patient from the list to view their profile</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
