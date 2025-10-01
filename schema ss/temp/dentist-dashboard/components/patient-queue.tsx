"use client"

import { useState } from "react"
import { Search, Plus, Filter, Phone, Calendar, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

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
  uhid: string // Added UHID field for patient identification
}

interface PatientQueueProps {
  patients?: Patient[]
  selectedPatientId?: string
  onPatientSelect?: (patient: Patient) => void
  onAddPatient?: () => void
  isLoading?: boolean // Added loading state prop
}

function PatientCardSkeleton() {
  return (
    <div className="p-3 rounded-lg border">
      <div className="flex items-start justify-between mb-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-5 w-16" />
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <Skeleton className="h-3 w-3" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="flex items-center gap-1">
          <Skeleton className="h-3 w-3" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="flex items-center gap-1">
          <Skeleton className="h-3 w-3" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
    </div>
  )
}

export function PatientQueue({
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
      uhid: "UH001234", // Added UHID
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
      uhid: "UH001235", // Added UHID
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
      uhid: "UH001236", // Added UHID
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
      uhid: "UH001237", // Added UHID
    },
  ],
  selectedPatientId = "1", // Default to first patient being selected
  onPatientSelect,
  onAddPatient,
  isLoading = false, // Added loading state with default false
}: PatientQueueProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

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

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Patient Queue</h2>
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Loading..." : `${filteredPatients.length} patients`}
            </p>
          </div>
          <Button size="sm" onClick={onAddPatient} disabled={isLoading}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Search and Filter */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search patients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              size="sm"
              disabled={isLoading}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter} disabled={isLoading}>
            <SelectTrigger className="w-full">
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
      </div>

      {/* Patient List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {isLoading && (
            <>
              {Array.from({ length: 5 }).map((_, index) => (
                <PatientCardSkeleton key={index} />
              ))}
            </>
          )}

          {!isLoading && filteredPatients.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-base font-medium mb-1">No patients found</p>
              <p className="text-sm">Try adjusting your search or filter criteria</p>
            </div>
          )}

          {!isLoading &&
            filteredPatients.map((patient) => (
              <div
                key={patient.id}
                className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm ${
                  selectedPatientId === patient.id
                    ? "bg-primary/10 border-primary shadow-md ring-1 ring-primary/20"
                    : "hover:bg-muted/50 border-border"
                }`}
                onClick={() => onPatientSelect?.(patient)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-medium text-sm">
                      {patient.firstName} {patient.lastName}
                    </h3>
                    <p className="text-xs text-muted-foreground">UHID: {patient.uhid}</p>
                  </div>
                  <Badge className={getStatusColor(patient.status)} variant="outline">
                    {patient.status}
                  </Badge>
                </div>

                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {patient.phone}
                  </div>
                  {patient.lastVisit && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Last: {new Date(patient.lastVisit).toLocaleDateString()}
                    </div>
                  )}
                  {patient.nextAppointment && (
                    <div className="flex items-center gap-1 text-primary font-medium">
                      <Calendar className="h-3 w-3" />
                      Next: {new Date(patient.nextAppointment).toLocaleDateString()} at 2:30 PM
                    </div>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
