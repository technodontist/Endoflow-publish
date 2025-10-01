'use client'

import { useState, useEffect } from 'react'
import { Search, ChevronDown, ChevronUp, Save, Send, ArrowLeft, Plus, X, Mic, FileText, Calendar, User, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { InteractiveDentalChart } from "./interactive-dental-chart"
import { createClient } from '@/lib/supabase/client'
import { format, differenceInYears } from 'date-fns'
import { EnhancedNewConsultation } from './enhanced-new-consultation'

interface Patient {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  date_of_birth: string
  medical_history_summary?: string
}

interface ConsultationData {
  patientId: string
  // Pain Assessment
  chiefComplaint: string
  painLocation: string
  painIntensity: number
  painDuration: string
  painCharacter: string
  painTriggers: string[]
  painRelief: string[]

  // Medical History
  medicalHistory: string[]
  currentMedications: string[]
  allergies: string[]
  previousDentalTreatments: string[]

  // Clinical Examination
  extraoralFindings: string
  intraoralFindings: string
  periodontalStatus: string
  occlusionNotes: string

  // Investigations
  radiographicFindings: string
  vitalityTests: string
  percussionTests: string
  palpationFindings: string

  // Diagnosis and Treatment Plan
  provisionalDiagnosis: string[]
  differentialDiagnosis: string[]
  treatmentPlan: string[]
  prognosis: string

  // Additional Notes
  additionalNotes: string
}

interface NewConsultationProps {
  selectedPatientId?: string
  onPatientSelect?: (patient: Patient) => void
}

export function NewConsultation({ selectedPatientId, onPatientSelect }: NewConsultationProps) {
  // Use the enhanced consultation component
  return (
    <EnhancedNewConsultation
      selectedPatientId={selectedPatientId}
      onPatientSelect={onPatientSelect}
    />
  )
}

export function OriginalNewConsultation({ selectedPatientId, onPatientSelect }: NewConsultationProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [consultationData, setConsultationData] = useState<ConsultationData>({
    patientId: '',
    chiefComplaint: '',
    painLocation: '',
    painIntensity: 0,
    painDuration: '',
    painCharacter: '',
    painTriggers: [],
    painRelief: [],
    medicalHistory: [],
    currentMedications: [],
    allergies: [],
    previousDentalTreatments: [],
    extraoralFindings: '',
    intraoralFindings: '',
    periodontalStatus: '',
    occlusionNotes: '',
    radiographicFindings: '',
    vitalityTests: '',
    percussionTests: '',
    palpationFindings: '',
    provisionalDiagnosis: [],
    differentialDiagnosis: [],
    treatmentPlan: [],
    prognosis: '',
    additionalNotes: ''
  })

  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState({
    painAssessment: true,
    clinicalExamination: false,
    investigations: false,
    diagnosisTreatment: false
  })

  useEffect(() => {
    if (searchTerm.length > 2) {
      searchPatients()
    } else {
      setPatients([])
    }
  }, [searchTerm])

  useEffect(() => {
    if (selectedPatientId) {
      loadPatientById(selectedPatientId)
    }
  }, [selectedPatientId])

  const searchPatients = async () => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      
      // Simple direct query to patients table like the working implementation
      const { data, error } = await supabase
        .schema('api')
        .from('patients')
        .select('*')
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .limit(10)

      if (error) {
        console.error('Error searching patients:', error)
        setPatients([])
        return
      }

      setPatients(data || [])
    } catch (error) {
      console.error('Error searching patients:', error)
      setPatients([])
    } finally {
      setIsLoading(false)
    }
  }

  const loadPatientById = async (patientId: string) => {
    try {
      const supabase = createClient()

      // Simple direct query to get patient data
      const { data, error } = await supabase
        .schema('api')
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single()

      if (error) throw error

      if (data) {
        setSelectedPatient(data)
        setConsultationData(prev => ({ ...prev, patientId: data.id }))
        onPatientSelect?.(data)
      }
    } catch (error) {
      console.error('Error loading patient:', error)
    }
  }

  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatient(patient)
    setConsultationData(prev => ({ ...prev, patientId: patient.id }))
    setSearchTerm("")
    setPatients([])
    onPatientSelect?.(patient)
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const updateConsultationData = (field: keyof ConsultationData, value: any) => {
    setConsultationData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const addToArray = (field: keyof ConsultationData, value: string) => {
    if (!value.trim()) return

    const currentArray = consultationData[field] as string[]
    updateConsultationData(field, [...currentArray, value.trim()])
  }

  const removeFromArray = (field: keyof ConsultationData, index: number) => {
    const currentArray = consultationData[field] as string[]
    updateConsultationData(field, currentArray.filter((_, i) => i !== index))
  }

  const getPatientAge = (dateOfBirth: string) => {
    return differenceInYears(new Date(), new Date(dateOfBirth))
  }

  const saveConsultation = async (isDraft: boolean = false) => {
    if (!selectedPatient) return

    try {
      const supabase = createClient()

      // Save consultation to database
      const { data, error } = await supabase
        .from('consultations')
        .insert({
          patient_id: selectedPatient.id,
          dentist_id: 'current-dentist-id', // Get from auth context
          consultation_date: new Date().toISOString(),
          chief_complaint: consultationData.chiefComplaint,
          pain_assessment: JSON.stringify({
            location: consultationData.painLocation,
            intensity: consultationData.painIntensity,
            duration: consultationData.painDuration,
            character: consultationData.painCharacter,
            triggers: consultationData.painTriggers,
            relief: consultationData.painRelief
          }),
          medical_history: JSON.stringify({
            history: consultationData.medicalHistory,
            medications: consultationData.currentMedications,
            allergies: consultationData.allergies,
            previousTreatments: consultationData.previousDentalTreatments
          }),
          clinical_examination: JSON.stringify({
            extraoral: consultationData.extraoralFindings,
            intraoral: consultationData.intraoralFindings,
            periodontal: consultationData.periodontalStatus,
            occlusion: consultationData.occlusionNotes
          }),
          investigations: JSON.stringify({
            radiographic: consultationData.radiographicFindings,
            vitality: consultationData.vitalityTests,
            percussion: consultationData.percussionTests,
            palpation: consultationData.palpationFindings
          }),
          diagnosis: JSON.stringify({
            provisional: consultationData.provisionalDiagnosis,
            differential: consultationData.differentialDiagnosis
          }),
          treatment_plan: JSON.stringify(consultationData.treatmentPlan),
          prognosis: consultationData.prognosis,
          additional_notes: consultationData.additionalNotes,
          status: isDraft ? 'draft' : 'completed'
        })

      if (error) throw error

      // Show success message
      alert(isDraft ? 'Consultation saved as draft' : 'Consultation completed successfully!')

    } catch (error) {
      console.error('Error saving consultation:', error)
      alert('Failed to save consultation')
    }
  }

  // If no patient is selected, show patient search
  if (!selectedPatient) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Consultation</h1>
          <p className="text-gray-600">Search and select a patient to begin consultation</p>
        </div>

        {/* Patient Search */}
        <Card>
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                type="text"
                placeholder="Search by patient name or UHID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 text-lg h-12"
              />
            </div>

            {/* Search Results */}
            {patients.length > 0 && (
              <div className="mt-4 space-y-2">
                {patients.map((patient) => (
                  <div
                    key={patient.id}
                    className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handlePatientSelect(patient)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {patient.first_name} {patient.last_name}
                        </h3>
                        <p className="text-sm text-gray-600">UHID: UH{patient.id.slice(-6)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">
                          {getPatientAge(patient.date_of_birth)} years, {patient.email?.includes('male') ? 'Male' : 'Female'}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          Active
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {searchTerm.length > 2 && patients.length === 0 && !isLoading && (
              <div className="mt-4 text-center py-8 text-gray-500">
                <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No patients found matching your search</p>
              </div>
            )}

            {searchTerm.length <= 2 && (
              <div className="mt-4 text-center py-8 text-gray-500">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Please search and select a patient from the search bar above to begin the consultation.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Consultation Form for Selected Patient
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setSelectedPatient(null)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Patient Search
            </Button>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">
            New Consultation for: {selectedPatient.first_name} {selectedPatient.last_name}
          </h1>
          <p className="text-gray-600">Complete clinical history and examination form</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => saveConsultation(true)}>
            <Save className="w-4 h-4 mr-2" />
            Save Draft
          </Button>
          <Button onClick={() => saveConsultation(false)} className="bg-teal-600 hover:bg-teal-700">
            <Send className="w-4 h-4 mr-2" />
            Complete Consultation
          </Button>
        </div>
      </div>

      {/* Patient Info Bar */}
      <Card className="border-l-4 border-l-teal-600">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h3 className="font-semibold">{selectedPatient.first_name} {selectedPatient.last_name}</h3>
                <p className="text-sm text-gray-600">UHID: UH{selectedPatient.id.slice(-6)}</p>
              </div>
              <div className="text-sm text-gray-600">
                <p>Age: {getPatientAge(selectedPatient.date_of_birth)} years</p>
                <p>DOB: {format(new Date(selectedPatient.date_of_birth), 'MMM d, yyyy')}</p>
              </div>
            </div>
            {selectedPatient.medical_history_summary && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Medical Alert
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Consultation Sections */}
      <div className="space-y-4">
        {/* Pain Assessment */}
        <Collapsible open={expandedSections.painAssessment} onOpenChange={() => toggleSection('painAssessment')}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-teal-600">Pain Assessment</CardTitle>
                  {expandedSections.painAssessment ? <ChevronUp /> : <ChevronDown />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div>
                  <Label>Chief Complaint</Label>
                  <Textarea
                    value={consultationData.chiefComplaint}
                    onChange={(e) => updateConsultationData('chiefComplaint', e.target.value)}
                    placeholder="Describe the patient's main concern..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Pain Location</Label>
                    <Input
                      value={consultationData.painLocation}
                      onChange={(e) => updateConsultationData('painLocation', e.target.value)}
                      placeholder="e.g., Upper right molar"
                    />
                  </div>
                  <div>
                    <Label>Pain Duration</Label>
                    <Input
                      value={consultationData.painDuration}
                      onChange={(e) => updateConsultationData('painDuration', e.target.value)}
                      placeholder="e.g., 3 days, 2 weeks"
                    />
                  </div>
                </div>

                <div>
                  <Label>Pain Intensity (0-10)</Label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0"
                      max="10"
                      value={consultationData.painIntensity}
                      onChange={(e) => updateConsultationData('painIntensity', parseInt(e.target.value))}
                      className="flex-1"
                    />
                    <span className="font-semibold w-8">{consultationData.painIntensity}</span>
                  </div>
                </div>

                <div>
                  <Label>Pain Character</Label>
                  <Select value={consultationData.painCharacter} onValueChange={(value) => updateConsultationData('painCharacter', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select pain character" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sharp">Sharp</SelectItem>
                      <SelectItem value="dull">Dull</SelectItem>
                      <SelectItem value="throbbing">Throbbing</SelectItem>
                      <SelectItem value="burning">Burning</SelectItem>
                      <SelectItem value="shooting">Shooting</SelectItem>
                      <SelectItem value="aching">Aching</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Clinical Examination */}
        <Collapsible open={expandedSections.clinicalExamination} onOpenChange={() => toggleSection('clinicalExamination')}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-teal-600">Clinical Examination</CardTitle>
                  {expandedSections.clinicalExamination ? <ChevronUp /> : <ChevronDown />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div>
                  <Label>Extraoral Findings</Label>
                  <Textarea
                    value={consultationData.extraoralFindings}
                    onChange={(e) => updateConsultationData('extraoralFindings', e.target.value)}
                    placeholder="Describe extraoral examination findings..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label>Intraoral Findings</Label>
                  <Textarea
                    value={consultationData.intraoralFindings}
                    onChange={(e) => updateConsultationData('intraoralFindings', e.target.value)}
                    placeholder="Describe intraoral examination findings..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Periodontal Status</Label>
                    <Textarea
                      value={consultationData.periodontalStatus}
                      onChange={(e) => updateConsultationData('periodontalStatus', e.target.value)}
                      placeholder="Gingival condition, pocket depths..."
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label>Occlusion Notes</Label>
                    <Textarea
                      value={consultationData.occlusionNotes}
                      onChange={(e) => updateConsultationData('occlusionNotes', e.target.value)}
                      placeholder="Bite relationship, contacts..."
                      rows={2}
                    />
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Investigations */}
        <Collapsible open={expandedSections.investigations} onOpenChange={() => toggleSection('investigations')}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-teal-600">Investigations</CardTitle>
                  {expandedSections.investigations ? <ChevronUp /> : <ChevronDown />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Radiographic Findings</Label>
                    <Textarea
                      value={consultationData.radiographicFindings}
                      onChange={(e) => updateConsultationData('radiographicFindings', e.target.value)}
                      placeholder="X-ray, CBCT findings..."
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>Vitality Tests</Label>
                    <Textarea
                      value={consultationData.vitalityTests}
                      onChange={(e) => updateConsultationData('vitalityTests', e.target.value)}
                      placeholder="Cold test, EPT results..."
                      rows={3}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Percussion Tests</Label>
                    <Textarea
                      value={consultationData.percussionTests}
                      onChange={(e) => updateConsultationData('percussionTests', e.target.value)}
                      placeholder="Vertical, horizontal percussion..."
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label>Palpation Findings</Label>
                    <Textarea
                      value={consultationData.palpationFindings}
                      onChange={(e) => updateConsultationData('palpationFindings', e.target.value)}
                      placeholder="Soft tissue examination..."
                      rows={2}
                    />
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Diagnosis and Treatment Plan */}
        <Collapsible open={expandedSections.diagnosisTreatment} onOpenChange={() => toggleSection('diagnosisTreatment')}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-teal-600">Diagnosis and Treatment Plan</CardTitle>
                  {expandedSections.diagnosisTreatment ? <ChevronUp /> : <ChevronDown />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-6">
                {/* Interactive Dental Chart */}
                <div>
                  <Label className="text-lg font-semibold">Interactive Dental Chart</Label>
                  <p className="text-sm text-gray-600 mb-4">Click on teeth to add diagnosis and treatment plans</p>
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <InteractiveDentalChart
                      patientId={selectedPatient.id}
                      onToothSelect={(toothNumber) => {
                        // This will open the full-screen diagnosis modal
                        console.log('Selected tooth:', toothNumber)
                      }}
                    />
                  </div>
                </div>

                <div>
                  <Label>Provisional Diagnosis</Label>
                  <Textarea
                    value={consultationData.provisionalDiagnosis.join('\n')}
                    onChange={(e) => updateConsultationData('provisionalDiagnosis', e.target.value.split('\n').filter(item => item.trim()))}
                    placeholder="Enter diagnoses (one per line)..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label>Treatment Plan</Label>
                  <Textarea
                    value={consultationData.treatmentPlan.join('\n')}
                    onChange={(e) => updateConsultationData('treatmentPlan', e.target.value.split('\n').filter(item => item.trim()))}
                    placeholder="Enter treatment steps (one per line)..."
                    rows={4}
                  />
                </div>

                <div>
                  <Label>Prognosis</Label>
                  <Select value={consultationData.prognosis} onValueChange={(value) => updateConsultationData('prognosis', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select prognosis" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="excellent">Excellent</SelectItem>
                      <SelectItem value="good">Good</SelectItem>
                      <SelectItem value="fair">Fair</SelectItem>
                      <SelectItem value="poor">Poor</SelectItem>
                      <SelectItem value="hopeless">Hopeless</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Additional Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-teal-600">Additional Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={consultationData.additionalNotes}
              onChange={(e) => updateConsultationData('additionalNotes', e.target.value)}
              placeholder="Any additional notes or observations..."
              rows={4}
            />
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-4 pb-8">
        <Button variant="outline" onClick={() => saveConsultation(true)}>
          <Save className="w-4 h-4 mr-2" />
          Save Draft
        </Button>
        <Button onClick={() => saveConsultation(false)} className="bg-teal-600 hover:bg-teal-700">
          <Send className="w-4 h-4 mr-2" />
          Complete Consultation
        </Button>
      </div>
    </div>
  )
}