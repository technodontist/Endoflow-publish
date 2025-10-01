"use client"

import { useState } from "react"
import { GripVertical } from "lucide-react"
import { useResizable } from "@/hooks/use-resizable"
import { PatientQueueList, type QueuePatient } from "@/components/dentist/patient-queue-list"
import { ClinicalCockpit } from "@/components/dentist/clinical-cockpit"

export function DentistPatientsTwoColumn() {
  const [selectedPatient, setSelectedPatient] = useState<QueuePatient | null>(null)
  const { width, isResizing, handleMouseDown } = useResizable({ initialWidth: 360, minWidth: 280, maxWidth: 520 })

  return (
    <div className="flex min-h-[600px] relative">
      {/* Left: Patient Queue */}
      <div style={{ width: `${width}px` }} className="flex-shrink-0">
        <PatientQueueList
          selectedPatientId={selectedPatient?.id}
          onPatientSelect={(p) => setSelectedPatient(p)}
        />
      </div>

      {/* Divider */}
      <div
        className={`w-1 bg-border hover:bg-primary/20 cursor-col-resize flex items-center justify-center group relative ${
          isResizing ? "bg-primary/30" : ""
        }`}
        onMouseDown={handleMouseDown}
      >
        <div className={`absolute inset-y-0 w-3 flex items-center justify-center ${isResizing ? "w-6" : ""}`}>
          <GripVertical className={`h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors ${
            isResizing ? "text-primary" : ""
          }`} />
        </div>
      </div>

      {/* Right: Clinical Cockpit */}
      <div className="flex-1 min-w-0 pl-4">
        <ClinicalCockpit
          selectedPatient={selectedPatient ? {
            id: selectedPatient.id,
            firstName: selectedPatient.firstName,
            lastName: selectedPatient.lastName,
            email: selectedPatient.email || "",
            phone: selectedPatient.phone || "",
            dateOfBirth: selectedPatient.dateOfBirth || "1990-01-01",
            lastVisit: selectedPatient.lastVisit || new Date().toISOString(),
            nextAppointment: selectedPatient.nextAppointment || undefined,
            status: selectedPatient.status,
            emergencyContact: "Not provided",
            medicalConditions: [],
            allergies: [],
            uhid: selectedPatient.uhid,
            address: undefined,
            bloodGroup: undefined,
            emergencyContactPhone: undefined,
          } : null}
        />
      </div>
    </div>
  )
}