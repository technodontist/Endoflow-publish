"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Plus, Trash2 } from "lucide-react"

interface FilterRule {
  id: string
  category: string
  operator: string
  value: string
  logic?: "AND" | "OR"
}

interface ProjectBuilderProps {
  onBack: () => void
}

export function ProjectBuilder({ onBack }: ProjectBuilderProps) {
  const [filterRules, setFilterRules] = useState<FilterRule[]>([{ id: "1", category: "", operator: "", value: "" }])

  const categories = ["Diagnosis", "Treatment", "Patient Age", "Gender", "Last Visit", "Insurance Type"]

  const operators = {
    Diagnosis: ["is", "is not", "contains"],
    Treatment: ["is", "is not", "contains"],
    "Patient Age": ["is", "is not", "is between", "greater than", "less than"],
    Gender: ["is", "is not"],
    "Last Visit": ["is", "is not", "is between", "before", "after"],
    "Insurance Type": ["is", "is not"],
  }

  // Mock patient data that matches filters
  const mockPatients = [
    { uhid: "UH001234", name: "Sarah Johnson", age: 34 },
    { uhid: "UH001235", name: "Michael Chen", age: 28 },
    { uhid: "UH001236", name: "Emily Rodriguez", age: 45 },
    { uhid: "UH001237", name: "David Wilson", age: 52 },
    { uhid: "UH001238", name: "Lisa Thompson", age: 39 },
  ]

  const addRule = () => {
    const newRule: FilterRule = {
      id: Date.now().toString(),
      category: "",
      operator: "",
      value: "",
      logic: "AND",
    }
    setFilterRules([...filterRules, newRule])
  }

  const removeRule = (id: string) => {
    setFilterRules(filterRules.filter((rule) => rule.id !== id))
  }

  const updateRule = (id: string, field: keyof FilterRule, value: string) => {
    setFilterRules(filterRules.map((rule) => (rule.id === id ? { ...rule, [field]: value } : rule)))
  }

  const getOperatorsForCategory = (category: string) => {
    return operators[category as keyof typeof operators] || []
  }

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      <div className="border-b bg-background p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Projects
          </Button>
          <h1 className="text-2xl font-bold text-primary">Project Builder</h1>
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-white">Save Project</Button>
      </div>

      <div className="flex-1 flex">
        {/* Left Panel - Cohort Builder (35%) */}
        <div className="w-[35%] border-r bg-muted/30 p-6 overflow-y-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Define Your Cohort</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {filterRules.map((rule, index) => (
                <div key={rule.id} className="space-y-3">
                  {index > 0 && (
                    <div className="flex items-center gap-2">
                      <Select value={rule.logic} onValueChange={(value) => updateRule(rule.id, "logic", value)}>
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AND">AND</SelectItem>
                          <SelectItem value="OR">OR</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="flex items-center gap-2 p-3 border rounded-lg bg-background">
                    <div className="flex-1 space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs">Category</Label>
                          <Select
                            value={rule.category}
                            onValueChange={(value) => updateRule(rule.id, "category", value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map((category) => (
                                <SelectItem key={category} value={category}>
                                  {category}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-xs">Operator</Label>
                          <Select
                            value={rule.operator}
                            onValueChange={(value) => updateRule(rule.id, "operator", value)}
                            disabled={!rule.category}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              {getOperatorsForCategory(rule.category).map((operator) => (
                                <SelectItem key={operator} value={operator}>
                                  {operator}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-xs">Value</Label>
                          <Input
                            value={rule.value}
                            onChange={(e) => updateRule(rule.id, "value", e.target.value)}
                            placeholder="Enter value..."
                            disabled={!rule.operator}
                          />
                        </div>
                      </div>
                    </div>

                    {filterRules.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeRule(rule.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              <Button variant="outline" onClick={addRule} className="w-full bg-transparent">
                <Plus className="w-4 h-4 mr-2" />
                Add Rule
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Live Results (65%) */}
        <div className="w-[65%] p-6 overflow-y-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Matching Patients: {mockPatients.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <div className="grid grid-cols-3 gap-4 p-3 bg-muted font-medium text-sm">
                  <div>UHID</div>
                  <div>Patient Name</div>
                  <div>Age</div>
                </div>
                {mockPatients.map((patient, index) => (
                  <div
                    key={patient.uhid}
                    className={`grid grid-cols-3 gap-4 p-3 text-sm ${
                      index % 2 === 0 ? "bg-background" : "bg-muted/50"
                    }`}
                  >
                    <div className="font-mono">{patient.uhid}</div>
                    <div>{patient.name}</div>
                    <div>{patient.age}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
