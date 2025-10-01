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
import { Mic, Save, Send, Search, User, MapPin, Activity } from "lucide-react"
import { InteractiveDentalChart } from "@/components/interactive-dental-chart"
import { FullScreenToothDiagnosis } from "@/components/full-screen-tooth-diagnosis"

interface Patient {
  id: string
  name: string
  uhid: string
  age: number
  sex: string
  address: string
  phone: string
  vitalSigns: {
    bloodPressure: string
    pulse: string
    temperature: string
    respiratoryRate: string
  }
}

const mockPatients: Patient[] = [
  {
    id: "1",
    name: "Sarah Johnson",
    uhid: "UH001234",
    age: 34,
    sex: "Female",
    address: "123 Oak Street, Springfield, IL 62701",
    phone: "+1 (555) 123-4567",
    vitalSigns: {
      bloodPressure: "120/80 mmHg",
      pulse: "72 bpm",
      temperature: "98.6°F",
      respiratoryRate: "16/min",
    },
  },
  {
    id: "2",
    name: "Michael Chen",
    uhid: "UH001235",
    age: 28,
    sex: "Male",
    address: "456 Pine Avenue, Springfield, IL 62702",
    phone: "+1 (555) 234-5678",
    vitalSigns: {
      bloodPressure: "118/75 mmHg",
      pulse: "68 bpm",
      temperature: "98.4°F",
      respiratoryRate: "14/min",
    },
  },
  {
    id: "3",
    name: "Emily Rodriguez",
    uhid: "UH001236",
    age: 42,
    sex: "Female",
    address: "789 Maple Drive, Springfield, IL 62703",
    phone: "+1 (555) 345-6789",
    vitalSigns: {
      bloodPressure: "125/82 mmHg",
      pulse: "75 bpm",
      temperature: "98.8°F",
      respiratoryRate: "15/min",
    },
  },
]

interface HistoryTakingFormProps {
  patientName?: string
}

interface FormData {
  chiefComplaint: string
  medicalHistory: {
    diabetes: boolean
    hypertension: boolean
    heartDisease: boolean
    allergies: boolean
    medications: string
    previousSurgeries: string
  }
  painAssessment: {
    intensity: string
    character: string
    duration: string
    triggers: string[]
  }
  clinicalExamination: {
    extraOral: string
    intraOral: string
    periodontal: string
    occlusion: string
  }
  investigations: {
    radiographs: string[]
    vitalityTests: string
    other: string
  }
}

export function HistoryTakingForm({ patientName }: HistoryTakingFormProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [showToothDiagnosis, setShowToothDiagnosis] = useState(false)
  const [selectedToothNumber, setSelectedToothNumber] = useState<string | null>(null)
  const [formData, setFormData] = useState<FormData>({
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
      character: "",
      duration: "",
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

  const filteredPatients = mockPatients.filter(
    (patient) =>
      patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.uhid.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatient(patient)
    setSearchQuery("")
    setShowSearchResults(false)
  }

  const handleDictation = () => {
    setIsRecording(!isRecording)
    // TODO: Integrate with actual speech recognition API
  }

  const handleToothSelect = (toothNumber: string) => {
    setSelectedToothNumber(toothNumber)
    setShowToothDiagnosis(true)
  }

  const handleBackToConsultation = () => {
    setShowToothDiagnosis(false)
    setSelectedToothNumber(null)
  }

  if (showToothDiagnosis && selectedToothNumber) {
    return (
      <FullScreenToothDiagnosis
        toothNumber={selectedToothNumber}
        patientName={selectedPatient?.name || ""}
        onBack={handleBackToConsultation}
      />
    )
  }

  return (
    <div className="h-full bg-background overflow-auto">
      <div className="border-b bg-card sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                New Consultation
                {selectedPatient && <span className="text-primary"> for: {selectedPatient.name}</span>}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedPatient
                  ? "Complete clinical history and examination form"
                  : "Search and select a patient to begin consultation"}
              </p>
            </div>

            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by patient name or UHID..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setShowSearchResults(e.target.value.length > 0)
                  }}
                  className="pl-10"
                />
              </div>

              {showSearchResults && searchQuery && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-lg shadow-lg z-20 max-h-60 overflow-auto">
                  {filteredPatients.length > 0 ? (
                    filteredPatients.map((patient) => (
                      <div
                        key={patient.id}
                        className="p-3 hover:bg-accent cursor-pointer border-b last:border-b-0"
                        onClick={() => handlePatientSelect(patient)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-foreground">{patient.name}</p>
                            <p className="text-sm text-muted-foreground">UHID: {patient.uhid}</p>
                          </div>
                          <div className="text-right text-sm text-muted-foreground">
                            <p>
                              {patient.age} years, {patient.sex}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-center text-muted-foreground">
                      No patients found matching "{searchQuery}"
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        {selectedPatient && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-primary">
                <User className="h-5 w-5" />
                Patient Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <h4 className="font-medium text-foreground">Personal Details</h4>
                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="font-medium">Name:</span> {selectedPatient.name}
                    </p>
                    <p>
                      <span className="font-medium">UHID:</span> {selectedPatient.uhid}
                    </p>
                    <p>
                      <span className="font-medium">Age:</span> {selectedPatient.age} years
                    </p>
                    <p>
                      <span className="font-medium">Sex:</span> {selectedPatient.sex}
                    </p>
                    <p>
                      <span className="font-medium">Phone:</span> {selectedPatient.phone}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium text-foreground flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Address
                  </h4>
                  <p className="text-sm text-muted-foreground">{selectedPatient.address}</p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium text-foreground flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Vital Signs
                  </h4>
                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="font-medium">BP:</span> {selectedPatient.vitalSigns.bloodPressure}
                    </p>
                    <p>
                      <span className="font-medium">Pulse:</span> {selectedPatient.vitalSigns.pulse}
                    </p>
                    <p>
                      <span className="font-medium">Temp:</span> {selectedPatient.vitalSigns.temperature}
                    </p>
                    <p>
                      <span className="font-medium">RR:</span> {selectedPatient.vitalSigns.respiratoryRate}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {selectedPatient ? (
          <>
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
                                    formData.medicalHistory[
                                      condition.id as keyof typeof formData.medicalHistory
                                    ] as boolean
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

                  <AccordionItem value="diagnosis-and-treatment-plan" className="border rounded-lg px-4">
                    <AccordionTrigger className="text-lg font-medium text-primary hover:no-underline">
                      Diagnosis and Treatment Plan
                    </AccordionTrigger>
                    <AccordionContent className="space-y-6 pt-4">
                      <div className="space-y-4">
                        <div className="text-sm text-muted-foreground">
                          <p>
                            Click on individual teeth to add diagnoses and treatment notes. The AI Co-Pilot will provide
                            evidence-based treatment suggestions.
                          </p>
                        </div>
                        <InteractiveDentalChart onToothSelect={handleToothSelect} />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>

            <div className="mt-8 flex justify-end gap-4 pb-6">
              <Button variant="outline" size="lg">
                <Save className="h-4 w-4 mr-2" />
                Save Draft
              </Button>
              <Button size="lg">
                <Send className="h-4 w-4 mr-2" />
                Complete Consultation
              </Button>
            </div>
          </>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <User className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No Patient Selected</h3>
              <p className="text-muted-foreground text-center">
                Please search and select a patient from the search bar above to begin the consultation.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
