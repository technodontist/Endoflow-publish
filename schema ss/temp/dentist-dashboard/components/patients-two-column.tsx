"use client"

import { useState } from "react"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { PatientQueue } from "@/components/patient-queue"
import { ClinicalCockpit } from "@/components/clinical-cockpit"

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
  uhid: string
}

interface PatientsTwoColumnProps {
  patients?: Patient[]
  onAddPatient?: () => void
}

export function PatientsTwoColumn({ patients, onAddPatient }: PatientsTwoColumnProps) {
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)

  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatient(patient)
  }

  return (
    <div className="h-full">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* Left Panel - Patient Queue */}
        <ResizablePanel defaultSize={30} minSize={25} maxSize={45}>
          <PatientQueue
            patients={patients}
            selectedPatientId={selectedPatient?.id}
            onPatientSelect={handlePatientSelect}
            onAddPatient={onAddPatient}
          />
        </ResizablePanel>

        {/* Resizable Handle */}
        <ResizableHandle withHandle />

        {/* Right Panel - Clinical Cockpit */}
        <ResizablePanel defaultSize={70} minSize={55}>
          <ClinicalCockpit selectedPatient={selectedPatient} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
