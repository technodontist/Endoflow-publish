"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Mic, Save, Send } from "lucide-react"
import Link from "next/link"

export default function HistoryTakingPage() {
  const [patientName] = useState("Sarah Johnson") // This would come from route params or context
  const [isRecording, setIsRecording] = useState(false)
  const [formData, setFormData] = useState({
    chiefComplaint: "",
    medicalHistory: {
      diabetes: false,
      hypertension: false,
      heartDisease: false,
      allergies: false,
      medications: "",
      previousSurgeries: "",
    },
    painAssessment: {
      intensity: "",
      duration: "",
      character: "",
      triggers: [],
    },
    clinicalExamination: {
      extraOral: "",
      intraOral: "",
      periodontal: "",
      occlusion: "",
    },
    investigations: {
      radiographs: [],
      vitalityTests: "",
      other: "",
    },
  })

  const handleDictation = () => {
    setIsRecording(!isRecording)
    console.log("[v0] Dictation toggled:", !isRecording)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-semibold text-foreground">
                  New Consultation for: <span className="text-primary">{patientName}</span>
                </h1>
                <p className="text-sm text-muted-foreground mt-1">Complete clinical history and examination form</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">
                <Save className="h-4 w-4 mr-2" />
                Save Draft
              </Button>
              <Button>
                <Send className="h-4 w-4 mr-2" />
                Complete Consultation
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl text-primary">Clinical History & Examination</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" defaultValue={["chief-complaint"]} className="space-y-4">
              <AccordionItem value="chief-complaint" className="border rounded-lg px-4">
                <AccordionTrigger className="text-lg font-medium text-primary hover:no-underline">
                  Chief Complaint
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="chief-complaint-text" className="text-sm font-medium">
                      Patient's primary concern and symptoms
                    </Label>
                    <div className="relative">
                      <Textarea
                        id="chief-complaint-text"
                        placeholder="Describe the patient's main complaint, onset, duration, and associated symptoms..."
                        className="min-h-[120px] pr-12"
                        value={formData.chiefComplaint}
                        onChange={(e) => setFormData((prev) => ({ ...prev, chiefComplaint: e.target.value }))}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant={isRecording ? "destructive" : "outline"}
                        className="absolute top-2 right-2"
                        onClick={handleDictation}
                      >
                        <Mic className={`h-4 w-4 ${isRecording ? "animate-pulse" : ""}`} />
                        {isRecording ? "Stop" : "Start"} Dictation
                      </Button>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="medical-history" className="border rounded-lg px-4">
                <AccordionTrigger className="text-lg font-medium text-primary hover:no-underline">
                  Medical History
                </AccordionTrigger>
                <AccordionContent className="space-y-6 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-medium text-foreground">Systemic Conditions</h4>
                      <div className="space-y-3">
                        {[
                          { id: "diabetes", label: "Diabetes Mellitus" },
                          { id: "hypertension", label: "Hypertension" },
                          { id: "heartDisease", label: "Cardiovascular Disease" },
                          { id: "allergies", label: "Known Allergies" },
                        ].map((condition) => (
                          <div key={condition.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={condition.id}
                              checked={
                                formData.medicalHistory[condition.id as keyof typeof formData.medicalHistory] as boolean
                              }
                              onCheckedChange={(checked) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  medicalHistory: { ...prev.medicalHistory, [condition.id]: checked },
                                }))
                              }
                            />
                            <Label htmlFor={condition.id} className="text-sm">
                              {condition.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="medications" className="text-sm font-medium">
                          Current Medications
                        </Label>
                        <Textarea
                          id="medications"
                          placeholder="List current medications, dosages, and frequency..."
                          className="mt-1"
                          value={formData.medicalHistory.medications}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              medicalHistory: { ...prev.medicalHistory, medications: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="surgeries" className="text-sm font-medium">
                          Previous Surgeries
                        </Label>
                        <Textarea
                          id="surgeries"
                          placeholder="List any previous surgical procedures..."
                          className="mt-1"
                          value={formData.medicalHistory.previousSurgeries}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              medicalHistory: { ...prev.medicalHistory, previousSurgeries: e.target.value },
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="pain-assessment" className="border rounded-lg px-4">
                <AccordionTrigger className="text-lg font-medium text-primary hover:no-underline">
                  Pain Assessment
                </AccordionTrigger>
                <AccordionContent className="space-y-6 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium">Pain Intensity (0-10 scale)</Label>
                        <RadioGroup
                          value={formData.painAssessment.intensity}
                          onValueChange={(value) =>
                            setFormData((prev) => ({
                              ...prev,
                              painAssessment: { ...prev.painAssessment, intensity: value },
                            }))
                          }
                          className="flex flex-wrap gap-4 mt-2"
                        >
                          {Array.from({ length: 11 }, (_, i) => (
                            <div key={i} className="flex items-center space-x-2">
                              <RadioGroupItem value={i.toString()} id={`pain-${i}`} />
                              <Label htmlFor={`pain-${i}`} className="text-sm">
                                {i}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Pain Character</Label>
                        <RadioGroup
                          value={formData.painAssessment.character}
                          onValueChange={(value) =>
                            setFormData((prev) => ({
                              ...prev,
                              painAssessment: { ...prev.painAssessment, character: value },
                            }))
                          }
                          className="mt-2 space-y-2"
                        >
                          {["Sharp", "Dull", "Throbbing", "Burning", "Shooting"].map((type) => (
                            <div key={type} className="flex items-center space-x-2">
                              <RadioGroupItem value={type.toLowerCase()} id={`char-${type}`} />
                              <Label htmlFor={`char-${type}`} className="text-sm">
                                {type}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="duration" className="text-sm font-medium">
                          Duration
                        </Label>
                        <Input
                          id="duration"
                          placeholder="e.g., 2 weeks, 3 days"
                          className="mt-1"
                          value={formData.painAssessment.duration}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              painAssessment: { ...prev.painAssessment, duration: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Pain Triggers</Label>
                        <div className="mt-2 space-y-2">
                          {["Hot foods", "Cold foods", "Sweet foods", "Chewing", "Pressure"].map((trigger) => (
                            <div key={trigger} className="flex items-center space-x-2">
                              <Checkbox
                                id={`trigger-${trigger}`}
                                checked={formData.painAssessment.triggers.includes(trigger)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setFormData((prev) => ({
                                      ...prev,
                                      painAssessment: {
                                        ...prev.painAssessment,
                                        triggers: [...prev.painAssessment.triggers, trigger],
                                      },
                                    }))
                                  } else {
                                    setFormData((prev) => ({
                                      ...prev,
                                      painAssessment: {
                                        ...prev.painAssessment,
                                        triggers: prev.painAssessment.triggers.filter((t) => t !== trigger),
                                      },
                                    }))
                                  }
                                }}
                              />
                              <Label htmlFor={`trigger-${trigger}`} className="text-sm">
                                {trigger}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="clinical-examination" className="border rounded-lg px-4">
                <AccordionTrigger className="text-lg font-medium text-primary hover:no-underline">
                  Clinical Examination
                </AccordionTrigger>
                <AccordionContent className="space-y-6 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="extra-oral" className="text-sm font-medium">
                          Extra-oral Examination
                        </Label>
                        <Textarea
                          id="extra-oral"
                          placeholder="Facial symmetry, lymph nodes, TMJ, muscle palpation..."
                          className="mt-1"
                          value={formData.clinicalExamination.extraOral}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              clinicalExamination: { ...prev.clinicalExamination, extraOral: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="intra-oral" className="text-sm font-medium">
                          Intra-oral Examination
                        </Label>
                        <Textarea
                          id="intra-oral"
                          placeholder="Soft tissues, hard tissues, tooth-specific findings..."
                          className="mt-1"
                          value={formData.clinicalExamination.intraOral}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              clinicalExamination: { ...prev.clinicalExamination, intraOral: e.target.value },
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="periodontal" className="text-sm font-medium">
                          Periodontal Assessment
                        </Label>
                        <Textarea
                          id="periodontal"
                          placeholder="Gingival condition, pocket depths, mobility, bleeding..."
                          className="mt-1"
                          value={formData.clinicalExamination.periodontal}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              clinicalExamination: { ...prev.clinicalExamination, periodontal: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="occlusion" className="text-sm font-medium">
                          Occlusal Analysis
                        </Label>
                        <Textarea
                          id="occlusion"
                          placeholder="Bite relationship, interferences, wear patterns..."
                          className="mt-1"
                          value={formData.clinicalExamination.occlusion}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              clinicalExamination: { ...prev.clinicalExamination, occlusion: e.target.value },
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="investigations" className="border rounded-lg px-4">
                <AccordionTrigger className="text-lg font-medium text-primary hover:no-underline">
                  Investigations
                </AccordionTrigger>
                <AccordionContent className="space-y-6 pt-4">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Radiographic Investigations</Label>
                      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-3">
                        {["Periapical", "Bitewing", "Panoramic", "CBCT", "Lateral Ceph", "PA Ceph"].map((type) => (
                          <div key={type} className="flex items-center space-x-2">
                            <Checkbox
                              id={`radio-${type}`}
                              checked={formData.investigations.radiographs.includes(type)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setFormData((prev) => ({
                                    ...prev,
                                    investigations: {
                                      ...prev.investigations,
                                      radiographs: [...prev.investigations.radiographs, type],
                                    },
                                  }))
                                } else {
                                  setFormData((prev) => ({
                                    ...prev,
                                    investigations: {
                                      ...prev.investigations,
                                      radiographs: prev.investigations.radiographs.filter((r) => r !== type),
                                    },
                                  }))
                                }
                              }}
                            />
                            <Label htmlFor={`radio-${type}`} className="text-sm">
                              {type}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="vitality" className="text-sm font-medium">
                          Vitality Tests
                        </Label>
                        <Textarea
                          id="vitality"
                          placeholder="Cold test, electric pulp test, percussion, palpation results..."
                          className="mt-1"
                          value={formData.investigations.vitalityTests}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              investigations: { ...prev.investigations, vitalityTests: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="other-investigations" className="text-sm font-medium">
                          Other Investigations
                        </Label>
                        <Textarea
                          id="other-investigations"
                          placeholder="Blood tests, biopsy, special tests..."
                          className="mt-1"
                          value={formData.investigations.other}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              investigations: { ...prev.investigations, other: e.target.value },
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
