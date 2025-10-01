"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Cable as Cube } from "lucide-react"
import { ToothDiagnosisDialog } from "./tooth-diagnosis-dialog"

interface ToothData {
  number: string
  status: "healthy" | "caries" | "filled" | "crown" | "missing" | "attention"
  diagnosis?: string
}

interface InteractiveDentalChartProps {
  onToothSelect?: (toothNumber: string) => void
}

export function InteractiveDentalChart({ onToothSelect }: InteractiveDentalChartProps) {
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // FDI tooth numbering system - Adult teeth
  const upperTeeth = ["18", "17", "16", "15", "14", "13", "12", "11", "21", "22", "23", "24", "25", "26", "27", "28"]
  const lowerTeeth = ["48", "47", "46", "45", "44", "43", "42", "41", "31", "32", "33", "34", "35", "36", "37", "38"]

  // Mock tooth data with various conditions
  const toothData: Record<string, ToothData> = {
    "16": { number: "16", status: "caries", diagnosis: "Deep caries" },
    "24": { number: "24", status: "filled", diagnosis: "Composite restoration" },
    "36": { number: "36", status: "crown", diagnosis: "Full crown" },
    "18": { number: "18", status: "missing" },
    "46": { number: "46", status: "attention", diagnosis: "Requires evaluation" },
  }

  const getToothColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "bg-green-100 border-green-300 hover:bg-green-200"
      case "caries":
        return "bg-red-100 border-red-300 hover:bg-red-200"
      case "filled":
        return "bg-blue-100 border-blue-300 hover:bg-blue-200"
      case "crown":
        return "bg-yellow-100 border-yellow-300 hover:bg-yellow-200"
      case "missing":
        return "bg-gray-200 border-gray-400 cursor-not-allowed"
      case "attention":
        return "bg-orange-100 border-orange-300 hover:bg-orange-200"
      default:
        return "bg-white border-gray-300 hover:bg-gray-50"
    }
  }

  const handleToothClick = (toothNumber: string) => {
    const tooth = toothData[toothNumber]
    if (tooth?.status === "missing") return

    if (onToothSelect) {
      onToothSelect(toothNumber)
    }
  }

  const renderTooth = (toothNumber: string, isUpper = true) => {
    const tooth = toothData[toothNumber] || { number: toothNumber, status: "healthy" }
    const colorClass = getToothColor(tooth.status)

    return (
      <div
        key={toothNumber}
        className={`
          relative w-8 h-12 ${colorClass} border-2 rounded-lg cursor-pointer 
          transition-all duration-200 flex items-center justify-center
          ${tooth.status === "missing" ? "opacity-50" : "hover:scale-105"}
        `}
        onClick={() => handleToothClick(toothNumber)}
        title={`Tooth ${toothNumber}${tooth.diagnosis ? ` - ${tooth.diagnosis}` : ""}`}
      >
        <span className="text-xs font-medium text-gray-700">{toothNumber}</span>
        {tooth.status !== "healthy" && tooth.status !== "missing" && (
          <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary"></div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with 3D Visual Aid Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Interactive Dental Chart</h3>
          <p className="text-sm text-muted-foreground">Click on any tooth to add diagnosis</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 flex items-center gap-2">
          <Cube className="h-4 w-4" />
          Open 3D Visual Aid
        </Button>
      </div>

      {/* Legend */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Legend</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
            <span className="text-xs">Healthy</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
            <span className="text-xs">Caries</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded"></div>
            <span className="text-xs">Filled</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded"></div>
            <span className="text-xs">Crown</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-200 border border-gray-400 rounded"></div>
            <span className="text-xs">Missing</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-100 border border-orange-300 rounded"></div>
            <span className="text-xs">Needs Attention</span>
          </div>
        </CardContent>
      </Card>

      {/* Dental Chart */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-8">
            {/* Upper Teeth */}
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-2">Upper Jaw (Maxilla)</div>
              <div className="flex justify-center gap-1">{upperTeeth.map((tooth) => renderTooth(tooth, true))}</div>
            </div>

            {/* Divider */}
            <div className="border-t border-dashed border-gray-300"></div>

            {/* Lower Teeth */}
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-2">Lower Jaw (Mandible)</div>
              <div className="flex justify-center gap-1">{lowerTeeth.map((tooth) => renderTooth(tooth, false))}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">26</div>
            <div className="text-xs text-muted-foreground">Healthy Teeth</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">1</div>
            <div className="text-xs text-muted-foreground">Caries</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">2</div>
            <div className="text-xs text-muted-foreground">Restorations</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">1</div>
            <div className="text-xs text-muted-foreground">Needs Attention</div>
          </CardContent>
        </Card>
      </div>

      {/* Diagnosis Dialog */}
      {selectedTooth && (
        <ToothDiagnosisDialog
          isOpen={isDialogOpen}
          onClose={() => {
            setIsDialogOpen(false)
            setSelectedTooth(null)
          }}
          toothNumber={selectedTooth}
        />
      )}
    </div>
  )
}
