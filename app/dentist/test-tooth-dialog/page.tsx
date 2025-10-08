"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ToothDiagnosisDialogV2 } from "@/components/dentist/tooth-diagnosis-dialog-v2"

export default function TestToothDialogPage() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow">
        <h1 className="text-3xl font-bold mb-4">🧪 Tooth Dialog Test Page</h1>
        <p className="text-gray-600 mb-6">
          This is a standalone test page to verify the 3-column dialog layout works without any caching issues.
        </p>

        <Button
          onClick={() => setIsOpen(true)}
          className="bg-teal-600 hover:bg-teal-700"
        >
          Open Tooth Diagnosis Dialog (V2 - 3 Column Layout)
        </Button>

        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <h3 className="font-semibold text-yellow-800 mb-2">What to expect:</h3>
          <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
            <li>Dialog should be very wide (95% viewport width)</li>
            <li>Should show 3 columns: Diagnosis | AI Co-pilot | Treatment Plan</li>
            <li>Purple/pink gradient header</li>
            <li>Yellow debug banner at the top</li>
          </ul>
        </div>

        <ToothDiagnosisDialogV2
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          toothNumber="11"
          patientId="test-patient-id"
          consultationId="test-consultation-id"
        />
      </div>
    </div>
  )
}
