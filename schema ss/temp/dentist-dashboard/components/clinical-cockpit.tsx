"use client"

import {
  Stethoscope,
  AlertTriangle,
  User,
  FileText,
  Bluetooth as Tooth,
  Camera,
  FlaskConical,
  CreditCard,
} from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { InteractiveDentalChart } from "./interactive-dental-chart"

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

interface ClinicalCockpitProps {
  selectedPatient?: Patient | null
}

export function ClinicalCockpit({ selectedPatient }: ClinicalCockpitProps) {
  if (!selectedPatient) {
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="w-full max-w-md mx-auto">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Stethoscope className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Clinical Cockpit</h3>
            <p className="text-muted-foreground text-sm">Select a patient to view their details</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const criticalAlerts =
    selectedPatient.allergies.length > 0 ||
    selectedPatient.medicalConditions.some(
      (condition) =>
        condition.toLowerCase().includes("diabetes") ||
        condition.toLowerCase().includes("heart") ||
        condition.toLowerCase().includes("blood pressure"),
    )

  return (
    <div className="h-full flex flex-col">
      <Card className="mb-4">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                {selectedPatient.firstName} {selectedPatient.lastName}
              </h2>
              <p className="text-sm text-muted-foreground">UHID: {selectedPatient.uhid}</p>
            </div>
            <div className="flex items-center gap-2">
              {criticalAlerts && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Medical Alert
                </Badge>
              )}
              <Badge variant={selectedPatient.status === "active" ? "default" : "secondary"}>
                {selectedPatient.status}
              </Badge>
            </div>
          </div>

          {(selectedPatient.allergies.length > 0 || selectedPatient.medicalConditions.length > 0) && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium text-red-800">Critical Medical Information</span>
              </div>
              {selectedPatient.allergies.length > 0 && (
                <div className="mb-2">
                  <span className="text-xs font-medium text-red-700">Allergies: </span>
                  <span className="text-xs text-red-600">{selectedPatient.allergies.join(", ")}</span>
                </div>
              )}
              {selectedPatient.medicalConditions.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-red-700">Conditions: </span>
                  <span className="text-xs text-red-600">{selectedPatient.medicalConditions.join(", ")}</span>
                </div>
              )}
            </div>
          )}
        </CardHeader>
      </Card>

      <Card className="flex-1">
        <CardContent className="p-0 h-full">
          <Tabs defaultValue="overview" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-6 rounded-none border-b">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="notes" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Clinical Notes
              </TabsTrigger>
              <TabsTrigger value="chart" className="flex items-center gap-2">
                <Tooth className="h-4 w-4" />
                Dental Chart
              </TabsTrigger>
              <TabsTrigger value="gallery" className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Image Gallery
              </TabsTrigger>
              <TabsTrigger value="lab" className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4" />
                Lab Rx
              </TabsTrigger>
              <TabsTrigger value="billing" className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Billing
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-auto">
              <TabsContent value="overview" className="p-6 m-0">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Patient Overview</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Date of Birth</label>
                      <p className="text-sm">{selectedPatient.dateOfBirth}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Last Visit</label>
                      <p className="text-sm">{selectedPatient.lastVisit}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Phone</label>
                      <p className="text-sm">{selectedPatient.phone}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Email</label>
                      <p className="text-sm">{selectedPatient.email}</p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="notes" className="p-6 m-0">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Clinical Notes</h3>
                  <p className="text-muted-foreground">Clinical notes and treatment history will be displayed here.</p>
                </div>
              </TabsContent>

              <TabsContent value="chart" className="p-6 m-0">
                <InteractiveDentalChart />
              </TabsContent>

              <TabsContent value="gallery" className="p-6 m-0">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Image Gallery</h3>
                  <p className="text-muted-foreground">Patient images and X-rays will be displayed here.</p>
                </div>
              </TabsContent>

              <TabsContent value="lab" className="p-6 m-0">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Lab Prescriptions</h3>
                  <p className="text-muted-foreground">Laboratory prescriptions and results will be displayed here.</p>
                </div>
              </TabsContent>

              <TabsContent value="billing" className="p-6 m-0">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Billing Information</h3>
                  <p className="text-muted-foreground">Patient billing and payment history will be displayed here.</p>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
