'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, ChevronDown, ChevronUp, Save, Send, ArrowLeft, Plus, X, Mic, MicOff, FileText, Calendar, User, AlertTriangle, CheckCircle, Clock, AlertCircle, Pill, ChevronLeft, ChevronRight, BarChart3 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { InteractiveDentalChart } from "./interactive-dental-chart"
import { createClient } from '@/lib/supabase/client'
import { format, differenceInYears } from 'date-fns'
import { getPatientToothDiagnoses } from '@/lib/actions/tooth-diagnoses'
import { ChiefComplaintTab } from '@/components/consultation/tabs/ChiefComplaintTab'
import { HOPITab } from '@/components/consultation/tabs/HOPITab'
import { MedicalHistoryTab } from '@/components/consultation/tabs/MedicalHistoryTab'
import { PersonalHistoryTab } from '@/components/consultation/tabs/PersonalHistoryTab'
import { ClinicalExaminationTab } from '@/components/consultation/tabs/ClinicalExaminationTab'
import { InvestigationsTab } from '@/components/consultation/tabs/InvestigationsTab'
import { FollowUpOverviewTab } from '@/components/consultation/tabs/FollowUpOverviewTab'
import { FollowUpTab } from '@/components/consultation/tabs/FollowUpTab'
import { PrescriptionTab } from '@/components/consultation/tabs/PrescriptionTab'
import { DiagnosisTab } from '@/components/consultation/tabs/DiagnosisTab'
import { DiagnosisOverviewTab } from '@/components/consultation/tabs/DiagnosisOverviewTab'
import { DiagnosisOverviewTabLive } from '@/components/consultation/tabs/DiagnosisOverviewTabLive'
import { TreatmentPlanTab } from '@/components/consultation/tabs/TreatmentPlanTab'
import { TreatmentOverviewTab } from '@/components/consultation/tabs/TreatmentOverviewTab'
import { TreatmentOverviewTabLive } from '@/components/consultation/tabs/TreatmentOverviewTabLive'
import { GlobalVoiceRecorder } from '@/components/consultation/GlobalVoiceRecorder'
import { ToothDiagnosisDialogV2 } from './tooth-diagnosis-dialog-v2'
import { saveCompleteConsultationAction, loadPatientConsultationAction, saveConsultationSectionAction, finalizeConsultationFromDraftAction } from '@/lib/actions/consultation'
import { AppointmentRequestDialog } from '@/components/consultation/AppointmentRequestDialog'

interface Patient {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  date_of_birth: string
  medical_history_summary?: string
}

interface ConsultationSection {
  id: string
  title: string
  icon: React.ReactNode
  status: 'empty' | 'partial' | 'complete'
  description: string
  data: any
  voiceEnabled: boolean
  component?: React.ComponentType<any>
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

  // HOPI specifics
  hopiOnsetDetails: string

  // Personal History (stored as object compatible with PersonalHistoryTab)
  personalHistory: any

  // Clinical Examination specifics
  oralHygieneStatus: string
  gingivalCondition: string

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
  radiographicTypes: string[]
  vitalityTests: string
  percussionTests: string
  palpationFindings: string
  laboratoryTests: string
  investigationRecommendations: string

  // Clinical Diagnosis
  provisionalDiagnosis: string[]
  differentialDiagnosis: string[]
  finalDiagnosis: string[]

  // Treatment Plan
  treatmentPlan: string[]
  prognosis: string

  // Prescription
  prescriptions: any[]

  // Follow-up
  followUpPlans: any

  // Additional Notes
  additionalNotes: string
}

interface VoiceSession {
  isActive: boolean
  sectionId: string | null
  transcript: string
  startTime: Date | null
}

interface EnhancedNewConsultationProps {
  selectedPatientId?: string
  appointmentId?: string
  dentistId?: string
  onPatientSelect?: (patient: Patient) => void
}

// 🚀 VERSION 3: Working Copy for Updates (V2 remains stable)
// DO NOT modify enhanced-new-consultation-v2.tsx - that's the stable version
export function EnhancedNewConsultationV3({ selectedPatientId, appointmentId, dentistId, onPatientSelect }: EnhancedNewConsultationProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null)
  const [showToothInterface, setShowToothInterface] = useState(false)
  const [toothData, setToothData] = useState<{[key: string]: any}>({})
  const [diagnosisHistory, setDiagnosisHistory] = useState<any[]>([])
  const [voiceSession, setVoiceSession] = useState<VoiceSession>({
    isActive: false,
    sectionId: null,
    transcript: '',
    startTime: null
  })
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingConsultation, setIsLoadingConsultation] = useState(false)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [savedConsultationId, setSavedConsultationId] = useState<string | null>(null)
  const [isConsultationCompleted, setIsConsultationCompleted] = useState(false)

  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [consultationData, setConsultationData] = useState<ConsultationData>({
    patientId: '',
    chiefComplaint: '',
    painLocation: '',
    painIntensity: 0,
    painDuration: '',
    painCharacter: '',
    painTriggers: [],
    painRelief: [],
    hopiOnsetDetails: '',
    personalHistory: {
      smoking: { status: 'never', duration: '', quantity: '', type: '', quit_date: '' },
      alcohol: { status: 'never', frequency: '', quantity: '', type: [] },
      tobacco: { status: 'never', type: [], duration: '', frequency: '', quit_date: '' },
      dietary_habits: [],
      oral_hygiene: {
        brushing_frequency: '',
        brushing_technique: '',
        flossing: '',
        mouthwash: '',
        last_cleaning: '',
        toothbrush_type: '',
        fluoride_exposure: []
      },
      other_habits: [],
      exercise_habits: '',
      sleep_patterns: '',
      stress_levels: '',
      occupation: '',
      occupational_hazards: [],
      lifestyle_factors: []
    },
    medicalHistory: [],
    currentMedications: [],
    allergies: [],
    previousDentalTreatments: [],
    extraoralFindings: '',
    intraoralFindings: '',
    periodontalStatus: '',
    occlusionNotes: '',
    oralHygieneStatus: '',
    gingivalCondition: '',
    radiographicFindings: '',
    radiographicTypes: [],
    vitalityTests: '',
    percussionTests: '',
    palpationFindings: '',
    laboratoryTests: '',
    investigationRecommendations: '',
    provisionalDiagnosis: [],
    differentialDiagnosis: [],
    finalDiagnosis: [],
    treatmentPlan: [],
    prognosis: '',
    prescriptions: [],
    followUpPlans: {
      appointments: [],
      post_care_instructions: [],
      tooth_specific_follow_ups: {},
      general_follow_up_notes: '',
      next_visit_required: false,
      emergency_contact_provided: false,
      patient_education_completed: false,
      recall_period: ''
    },
    additionalNotes: ''
  })

  const getConsultationSections = (): ConsultationSection[] => {
    console.log('🏗️ [SECTIONS BUILDER] Building sections with consultationData:', {
      chiefComplaint: consultationData.chiefComplaint,
      painIntensity: consultationData.painIntensity,
      painCharacter: consultationData.painCharacter,
      chiefComplaintData: consultationData.chiefComplaintData,
      hopiData: consultationData.hopiData,
      confidence: consultationData.confidence
    })

    const sections = [
      {
        id: 'chief-complaint',
        title: 'Chief Complaint',
        icon: <AlertTriangle className="w-5 h-5" />,
        status: getSectionStatus('chief-complaint'),
        description: 'Primary concern, pain assessment',
        data: {
          primary_complaint: consultationData.chiefComplaint,
          patient_description: consultationData.chiefComplaintData?.patient_description || consultationData.painLocation || '',
          pain_scale: consultationData.painIntensity || 0,
          pain_quality: consultationData.painCharacter || '',
          pain_characteristics: consultationData.hopiData?.pain_characteristics,
          location_detail: consultationData.chiefComplaintData?.location_detail || '',
          onset_duration: consultationData.chiefComplaintData?.onset_duration || '',
          associated_symptoms: consultationData.chiefComplaintData?.associated_symptoms || [],
          triggers: consultationData.chiefComplaintData?.triggers || [],
          auto_extracted: consultationData.chiefComplaintData?.auto_extracted,
          extraction_timestamp: consultationData.chiefComplaintData?.extraction_timestamp,
          confidence: consultationData.confidence
        },
        voiceEnabled: true,
        component: ChiefComplaintTab
      },
      {
        id: 'hopi',
        title: 'HOPI',
        icon: <FileText className="w-5 h-5" />,
        status: getSectionStatus('hopi'),
        description: 'History of Present Illness',
        data: {
          onset_details: consultationData.hopiData?.onset_details?.when_started || consultationData.hopiOnsetDetails || '',
          duration: consultationData.hopiData?.pain_characteristics?.duration || consultationData.painDuration || '',
          aggravating_factors: consultationData.hopiData?.aggravating_factors || consultationData.painTriggers || [],
          relieving_factors: consultationData.hopiData?.relieving_factors || consultationData.painRelief || [],
          pain_characteristics: consultationData.hopiData?.pain_characteristics,
          associated_symptoms: consultationData.hopiData?.associated_symptoms || [],
          previous_episodes: consultationData.hopiData?.previous_episodes || '',
          pattern_changes: consultationData.hopiData?.pattern_changes || '',
          previous_treatments: consultationData.hopiData?.previous_treatments || [],
          auto_extracted: consultationData.hopiData?.auto_extracted,
          extraction_timestamp: consultationData.hopiData?.extraction_timestamp,
          confidence: consultationData.confidence
        },
        voiceEnabled: true,
        component: HOPITab
      },
    {
      id: 'medical-history',
      title: 'Medical History',
      icon: <FileText className="w-5 h-5" />,
      status: getSectionStatus('medical-history'),
      description: 'Past medical history, medications, allergies',
      data: {
        medicalHistory: consultationData.medicalHistory,
        currentMedications: consultationData.currentMedications,
        allergies: consultationData.allergies
      },
      voiceEnabled: true,
      component: MedicalHistoryTab
    },
    {
      id: 'personal-history',
      title: 'Personal History',
      icon: <User className="w-5 h-5" />,
      status: getSectionStatus('personal-history'),
      description: 'Habits, lifestyle, oral hygiene',
      data: {
        previousDentalTreatments: consultationData.previousDentalTreatments
      },
      voiceEnabled: true,
      component: PersonalHistoryTab
    },
    {
      id: 'clinical-examination',
      title: 'Clinical Examination',
      icon: <Search className="w-5 h-5" />,
      status: getSectionStatus('clinical-examination'),
      description: 'Extraoral & intraoral findings',
      data: {
        extraoralFindings: consultationData.extraoralFindings,
        intraoralFindings: consultationData.intraoralFindings,
        periodontalStatus: consultationData.periodontalStatus
      },
      voiceEnabled: true,
      component: ClinicalExaminationTab
    },
    {
      id: 'investigations',
      title: 'Investigations',
      icon: <FileText className="w-5 h-5" />,
      status: getSectionStatus('investigations'),
      description: 'Radiographic findings, tests',
      data: {
        radiographicFindings: consultationData.radiographicFindings,
        vitalityTests: consultationData.vitalityTests,
        percussionTests: consultationData.percussionTests
      },
      voiceEnabled: true,
      component: InvestigationsTab
    },
    {
      id: 'clinical-diagnosis',
      title: 'Clinical Diagnosis',
      icon: <AlertTriangle className="w-5 h-5" />,
      status: getSectionStatus('clinical-diagnosis'),
      description: 'Per-tooth diagnoses from FDI + optional provisional/differential/final',
      data: toothData,
      voiceEnabled: true,
      component: DiagnosisOverviewTab,
      // Explicitly mark as current-only (no history)
      showHistory: false as any
    },
    {
      id: 'treatment-plan',
      title: 'Treatment Plan',
      icon: <CheckCircle className="w-5 h-5" />,
      status: getSectionStatus('treatment-plan'),
      description: 'Per-tooth treatments from FDI + optional prognosis',
      data: toothData,
      voiceEnabled: true,
      component: TreatmentOverviewTab,
      // Explicitly mark as current-only (no history)
      showHistory: false as any
    },
    {
      id: 'prescription',
      title: 'Prescription',
      icon: <Pill className="w-5 h-5" />,
      status: getSectionStatus('prescription'),
      description: 'Medications and prescriptions',
      data: {
        prescriptions: consultationData.prescriptions,
        previous_prescriptions: consultationData.prescriptions,
        current_medications: consultationData.currentMedications,
        medical_conditions: consultationData.medicalHistory,
        allergies: consultationData.allergies
      },
      voiceEnabled: false,
      component: PrescriptionTab
    },
    {
      id: 'follow-up-overview',
      title: 'Follow-Up Overview',
      icon: <BarChart3 className="w-5 h-5" />,
      status: getSectionStatus('follow-up-overview'),
      description: 'Real-time view of follow-up appointments and treatment progress',
      data: {},
      voiceEnabled: false,
      component: FollowUpOverviewTab,
      showHistory: true as any
    },
    {
      id: 'diagnosis-overview',
      title: 'Live Diagnosis Overview',
      icon: <AlertTriangle className="w-5 h-5" />,
      status: getSectionStatus('diagnosis-overview'),
      description: 'Real-time view of all diagnoses with appointment status',
      data: toothData,
      voiceEnabled: false,
      component: DiagnosisOverviewTabLive,
      // Overview shows history
      showHistory: true as any
    },
    {
      id: 'treatment-overview',
      title: 'Live Treatment Overview',
      icon: <CheckCircle className="w-5 h-5" />,
      status: getSectionStatus('treatment-overview'),
      description: 'Real-time view of all treatment plans and appointments',
      data: toothData,
      voiceEnabled: false,
      component: TreatmentOverviewTabLive,
      // Overview shows history
      showHistory: true as any
    }
  ]

    console.log('🎯 [SECTIONS BUILDER] Chief Complaint section data:', sections[0].data)
    console.log('🎯 [SECTIONS BUILDER] HOPI section data:', sections[1].data)

    return sections
  }

  const getSectionValidation = (sectionId: string) => {
    const basicStatus = getSectionStatus(sectionId)
    return {
      status: basicStatus,
      isValid: true,
      errors: [],
      warnings: []
    }
  }

  function getSectionStatus(sectionId: string): 'empty' | 'partial' | 'complete' {
    switch (sectionId) {
      case 'chief-complaint':
        const painFields = [consultationData.chiefComplaint, consultationData.painLocation, consultationData.painDuration]
        if (painFields.every(field => !field)) return 'empty'
        if (painFields.some(field => !field)) return 'partial'
        return 'complete'
      case 'hopi':
        const hopiFields = [consultationData.painCharacter, consultationData.painTriggers, consultationData.painRelief]
        if (hopiFields.every(field => !field || (Array.isArray(field) && field.length === 0))) return 'empty'
        if (hopiFields.some(field => !field || (Array.isArray(field) && field.length === 0))) return 'partial'
        return 'complete'
      case 'medical-history':
        const historyFields = [consultationData.medicalHistory, consultationData.currentMedications, consultationData.allergies]
        if (historyFields.every(field => field.length === 0)) return 'empty'
        if (historyFields.some(field => field.length === 0)) return 'partial'
        return 'complete'
      case 'personal-history':
        try {
          const p = consultationData.personalHistory || {}
          const hasAny = (
            (p.smoking?.status && p.smoking.status !== 'never') ||
            (Array.isArray(p.alcohol?.type) && p.alcohol.type.length > 0) ||
            (Array.isArray(p.tobacco?.type) && p.tobacco.type.length > 0) ||
            (Array.isArray(p.dietary_habits) && p.dietary_habits.length > 0) ||
            (p.oral_hygiene?.brushing_frequency || p.oral_hygiene?.flossing || p.oral_hygiene?.last_cleaning) ||
            (Array.isArray(p.other_habits) && p.other_habits.length > 0) ||
            (p.exercise_habits && p.exercise_habits.trim()) ||
            (p.sleep_patterns && p.sleep_patterns.trim()) ||
            (p.stress_levels && p.stress_levels.trim()) ||
            (p.occupation && p.occupation.trim()) ||
            (Array.isArray(p.occupational_hazards) && p.occupational_hazards.length > 0) ||
            (Array.isArray(p.lifestyle_factors) && p.lifestyle_factors.length > 0)
          )
          return hasAny ? 'complete' : 'empty'
        } catch {
          return 'empty'
        }
      case 'clinical-examination':
        const examFields = [consultationData.extraoralFindings, consultationData.intraoralFindings, consultationData.periodontalStatus]
        if (examFields.every(field => !field)) return 'empty'
        if (examFields.some(field => !field)) return 'partial'
        return 'complete'
      case 'investigations':
        const investigationFields = [consultationData.radiographicFindings, consultationData.vitalityTests, consultationData.percussionTests]
        if (investigationFields.every(field => !field)) return 'empty'
        if (investigationFields.some(field => !field)) return 'partial'
        return 'complete'
      case 'clinical-diagnosis':
        const diagnosisFields = [consultationData.provisionalDiagnosis, consultationData.differentialDiagnosis]
        if (diagnosisFields.every(field => field.length === 0)) return 'empty'
        if (diagnosisFields.some(field => field.length === 0)) return 'partial'
        return 'complete'
      case 'treatment-plan':
        if (!consultationData.treatmentPlan.length && !consultationData.prognosis) return 'empty'
        if (!consultationData.treatmentPlan.length || !consultationData.prognosis) return 'partial'
        return 'complete'
      case 'prescription':
        return consultationData.prescriptions.length > 0 ? 'complete' : 'empty'
      case 'diagnosis-overview':
        const teethWithDiagnoses = Object.values(toothData).filter((tooth: any) => (tooth as any).selectedDiagnoses?.length > 0)
        return teethWithDiagnoses.length > 0 ? 'complete' : 'empty'
      case 'treatment-overview':
        const teethWithTreatments = Object.values(toothData).filter((tooth: any) => (tooth as any).selectedTreatments?.length > 0)
        return teethWithTreatments.length > 0 ? 'complete' : 'empty'
      default:
        return 'empty'
    }
  }

  const getStatusColor = (status: 'empty' | 'partial' | 'complete') => {
    switch (status) {
      case 'empty':
        return 'bg-gray-100 border-gray-300 text-gray-600'
      case 'partial':
        return 'bg-yellow-100 border-yellow-300 text-yellow-800'
      case 'complete':
        return 'bg-green-100 border-green-300 text-green-800'
    }
  }

  const getStatusIcon = (status: 'empty' | 'partial' | 'complete') => {
    switch (status) {
      case 'empty':
        return <AlertCircle className="w-4 h-4 text-gray-400" />
      case 'partial':
        return <Clock className="w-4 h-4 text-yellow-500" />
      case 'complete':
        return <CheckCircle className="w-4 h-4 text-green-500" />
    }
  }

  const startVoiceSession = async (sectionId: string) => {
    try {
      setVoiceSession({
        isActive: true,
        sectionId,
        transcript: '',
        startTime: new Date()
      })
      console.log(`🎤 Started voice session for section: ${sectionId}`)
    } catch (error) {
      console.error('Error starting voice session:', error)
      setVoiceSession({ isActive: false, sectionId: null, transcript: '', startTime: null })
    }
  }

  const stopVoiceSession = async () => {
    try {
      console.log(`🛑 Stopped voice session for section: ${voiceSession.sectionId}`)
      setVoiceSession({ isActive: false, sectionId: null, transcript: '', startTime: null })
    } catch (error) {
      console.error('Error stopping voice session:', error)
    }
  }

  const distributeContentToTabs = (processedContent: any) => {
    console.log('🎯 Distributing AI-processed content to consultation tabs...')

    try {
      setConsultationData(prev => {
        const updated = { ...prev }
        if (processedContent.chiefComplaint) {
          const cc = processedContent.chiefComplaint
          if (cc.primary_complaint) updated.chiefComplaint = cc.primary_complaint
          if (cc.pain_scale) updated.painIntensity = cc.pain_scale
          if (cc.patient_description) updated.painLocation = cc.patient_description

          // Store complete Chief Complaint AI data for tab consumption
          updated.chiefComplaintData = cc
          updated.confidence = processedContent.confidence
        }
        if (processedContent.hopi) {
          const hopi = processedContent.hopi
          if (hopi.pain_characteristics?.quality) updated.painCharacter = hopi.pain_characteristics.quality
          if (hopi.pain_characteristics?.duration) updated.painDuration = hopi.pain_characteristics.duration
          if (hopi.duration) updated.painDuration = hopi.duration
          if (hopi.onset_details) updated.hopiOnsetDetails = hopi.onset_details
          if (hopi.aggravating_factors) updated.painTriggers = hopi.aggravating_factors
          if (hopi.relieving_factors) updated.painRelief = hopi.relieving_factors

          // Store complete HOPI AI data for tab consumption
          updated.hopiData = hopi
        }
        if (processedContent.medicalHistory) {
          const medHist = processedContent.medicalHistory
          if (medHist.medical_conditions) {
            updated.medicalHistory = medHist.medical_conditions.map((cond: any) =>
              typeof cond === 'string' ? cond : cond.condition || cond.name
            )
          }
          if (medHist.current_medications) {
            updated.currentMedications = medHist.current_medications.map((med: any) =>
              typeof med === 'string' ? med : med.name || med.medication
            )
          }
          if (medHist.allergies) {
            updated.allergies = medHist.allergies.map((allergy: any) =>
              typeof allergy === 'string' ? allergy : allergy.allergen || allergy.name
            )
          }
          if (medHist.previous_dental_treatments || medHist.previousDentalTreatments) {
            const src = medHist.previous_dental_treatments || medHist.previousDentalTreatments
            updated.previousDentalTreatments = (src || []).map((t: any) => typeof t === 'string' ? t : t.name || t.treatment)
          }
          if (medHist.additional_notes) {
            updated.additionalNotes = medHist.additional_notes
          }
        }
        if (processedContent.clinicalExamination) {
          const clinExam = processedContent.clinicalExamination
          if (clinExam.extraoral_findings) {
            const extraoral = Object.values(clinExam.extraoral_findings).join('; ')
            updated.extraoralFindings = extraoral
          }
          if (clinExam.intraoral_findings) {
            const intraoral = Object.values(clinExam.intraoral_findings).join('; ')
            updated.intraoralFindings = intraoral
          }
        }
        if (processedContent.investigations) {
          const investigations = processedContent.investigations
          if (investigations.radiographic?.findings) {
            updated.radiographicFindings = investigations.radiographic.findings
          }
          if (investigations.clinical_tests) {
            const clinicalTests = Object.entries(investigations.clinical_tests)
              .map(([test, result]) => `${test}: ${result}`)
              .join('; ')
            updated.vitalityTests = clinicalTests
          }
        }
        if (processedContent.diagnosis) {
          const diagnosis = processedContent.diagnosis
          if (diagnosis.provisional_diagnosis) {
            updated.provisionalDiagnosis = diagnosis.provisional_diagnosis.map((diag: any) =>
              typeof diag === 'string' ? diag : diag.diagnosis || diag.name
            )
          }
          if (diagnosis.differential_diagnosis) {
            updated.differentialDiagnosis = diagnosis.differential_diagnosis.map((diag: any) =>
              typeof diag === 'string' ? diag : diag.diagnosis || diag.name
            )
          }
        }
        if (processedContent.treatmentPlan) {
          const treatment = processedContent.treatmentPlan
          if (treatment.procedures) {
            updated.treatmentPlan = treatment.procedures.map((proc: any) =>
              typeof proc === 'string' ? proc : proc.procedure || proc.name
            )
          }
          if (treatment.recommendations) {
            updated.prognosis = treatment.recommendations
          }
        }
        console.log('✅ Successfully distributed content to consultation data:', updated)
        return updated
      })
      console.log(`🎉 Voice content successfully distributed to ${Object.keys(processedContent).length} sections`)
    } catch (error) {
      console.error('❌ Error distributing content to tabs:', error)
    }
  }

  const queueAutoSaveSection = (sectionId: string, data: any) => {
    try {
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current)
      autoSaveRef.current = setTimeout(async () => {
        if (!selectedPatient) return
        const result = await saveConsultationSectionAction({
          patientId: selectedPatient.id,
          consultationId: savedConsultationId || undefined,
          sectionId,
          sectionData: data
        })
        if (result.success && result.consultationId && result.consultationId !== savedConsultationId) {
          setSavedConsultationId(result.consultationId)
        }
      }, 800)
    } catch (e) {
      console.error('Auto-save failed', e)
    }
  }

  const updateConsultationFromTabData = (sectionId: string, tabData: any) => {
    console.log(`🔄 Updating consultation data from ${sectionId} tab:`, tabData)

    setConsultationData(prev => {
      const updated = { ...prev }

      switch (sectionId) {
        case 'chief-complaint':
          updated.chiefComplaint = tabData.primary_complaint || ''
          updated.painDuration = tabData.onset_duration || ''
          updated.painIntensity = tabData.severity_scale || tabData.pain_scale || 0
          updated.painLocation = tabData.location_detail || ''
          // Persist associated symptoms correctly so checkboxes don't reset
          updated.painTriggers = tabData.associated_symptoms || tabData.triggers || []
          break
        case 'hopi':
          updated.painCharacter = tabData.pain_characteristics?.quality || updated.painCharacter || ''
          // Accept duration either from pain_characteristics.duration or the tab's top-level duration field
          updated.painDuration = tabData.duration || tabData.pain_characteristics?.duration || updated.painDuration
          updated.painIntensity = tabData.pain_characteristics?.intensity || updated.painIntensity
          updated.painTriggers = tabData.aggravating_factors || []
          updated.painRelief = tabData.relieving_factors || []
          // Persist onset details free text from HOPI tab
          updated.hopiOnsetDetails = tabData.onset_details || updated.hopiOnsetDetails || ''
          break
        case 'medical-history':
          // Align keys with MedicalHistoryTab props
          updated.medicalHistory = tabData.medical_conditions || []
          updated.currentMedications = tabData.current_medications || []
          updated.allergies = tabData.allergies || []
          // Persist previous dental treatments and notes
          updated.previousDentalTreatments = tabData.previous_dental_treatments || updated.previousDentalTreatments || []
          if (tabData.additional_notes) updated.additionalNotes = tabData.additional_notes
          break
        case 'personal-history':
          // Store complete personal history payload for rehydration
          updated.personalHistory = tabData || updated.personalHistory
          // Optional: keep a brief summary in previousDentalTreatments for overview/progress
          try {
            const oh = tabData?.oral_hygiene || {}
            updated.previousDentalTreatments = [
              `Brushing: ${oh.brushing_frequency || 'Not specified'}`,
              `Flossing: ${oh.flossing || 'Not specified'}`,
              `Last cleaning: ${oh.last_cleaning || 'Not specified'}`
            ]
          } catch {}
          break
        case 'clinical-examination':
          // Accept both string fields and arrays for the new checkbox-based UI
          const toList = (v: any) => Array.isArray(v) ? v.join(', ') : (typeof v === 'string' ? v : '')
          updated.extraoralFindings = toList(tabData.extraoral_findings)
          updated.intraoralFindings = toList(tabData.intraoral_findings)
          updated.periodontalStatus = tabData.periodontal_status || ''
          updated.occlusionNotes = toList(tabData.occlusion_notes)
          // Persist oral hygiene and gingival condition selects
          updated.oralHygieneStatus = tabData.oral_hygiene || updated.oralHygieneStatus || ''
          updated.gingivalCondition = tabData.gingival_condition || updated.gingivalCondition || ''
          break
        case 'investigations':
          // Accept either nested object shape or flat keys; coerce arrays to string summaries for storage
          const toStr = (v: any) => Array.isArray(v) ? v.join(', ') : (v || '')
          updated.radiographicFindings = tabData.radiographic?.findings || tabData.radiographic_findings || ''
          updated.radiographicTypes = tabData.radiographic_types || updated.radiographicTypes || []
          updated.vitalityTests = toStr(tabData.clinical_tests?.vitality_test ?? tabData.vitality_tests)
          updated.percussionTests = toStr(tabData.clinical_tests?.percussion_test ?? tabData.percussion_tests)
          updated.palpationFindings = toStr(tabData.clinical_tests?.palpation_test ?? tabData.palpation_findings)
          updated.laboratoryTests = (tabData.laboratory_tests ?? updated.laboratoryTests) ?? ''
          updated.investigationRecommendations = (tabData.recommendations ?? updated.investigationRecommendations) ?? ''
          break
        case 'clinical-diagnosis':
          // Accept both string and array payloads from the tab component
          const prov = tabData.provisional_diagnoses ?? tabData.provisional_diagnosis
          const diff = tabData.differential_diagnoses ?? tabData.differential_diagnosis
          const fin = tabData.final_diagnoses ?? tabData.final_diagnosis
          const toArray = (v: any) => Array.isArray(v) ? v : (typeof v === 'string' && v.trim() ? [v.trim()] : [])
          updated.provisionalDiagnosis = toArray(prov)
          updated.differentialDiagnosis = toArray(diff)
          updated.finalDiagnosis = toArray(fin)
          break
        case 'treatment-plan':
          // Accept planned procedures + prognosis from the tab
          updated.treatmentPlan = tabData.planned_procedures || []
          updated.prognosis = tabData.prognosis || tabData.overall_prognosis || ''
          break
        case 'prescription':
          // Accept new advanced tab payloads
          if (Array.isArray(tabData?.prescriptions)) {
            updated.prescriptions = tabData.prescriptions
          } else if (Array.isArray(tabData?.medications)) {
            updated.prescriptions = tabData.medications
          } else if (Array.isArray(tabData?.prescribed_medications)) {
            updated.prescriptions = tabData.prescribed_medications
          }
          break
        case 'follow-up':
          // Store the full follow-up object (appointments, tooth-specific, etc.)
          if (tabData && typeof tabData === 'object') {
            updated.followUpPlans = tabData
          }
          break
        default:
          console.log(`No update handler for section: ${sectionId}`)
          break
      }

      console.log(`✅ Updated consultation data for ${sectionId}:`, updated)
      return updated
    })
  }

  const searchPatients = async () => {
    setIsLoading(true)
    try {
      const supabase = createClient()
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

  useEffect(() => {
    if (searchTerm.length > 2) {
      searchPatients()
    } else {
      setPatients([])
    }
  }, [searchTerm])

  // Auto-select patient when deep-linked from organizer
  useEffect(() => {
    const run = async () => {
      if (!selectedPatientId || selectedPatient?.id === selectedPatientId) return
      try {
        const supabase = createClient()
        const { data } = await supabase
          .schema('api')
          .from('patients')
          .select('*')
          .eq('id', selectedPatientId)
          .single()
        if (data) {
          await handlePatientSelect(data as any)
        }
      } catch (e) {
        console.warn('Auto-select patient failed', e)
      }
    }
    run()
  }, [selectedPatientId])

  // Realtime refresh for tooth diagnoses and treatments
  const [historyVersion, setHistoryVersion] = useState(0)
  useEffect(() => {
    if (!selectedPatient?.id) return
    const client = createClient()
    const channel = client
      .channel(`cons-v2-${selectedPatient.id}`)
      .on('postgres_changes', { event: '*', schema: 'api', table: 'tooth_diagnoses', filter: `patient_id=eq.${selectedPatient.id}` }, () => setHistoryVersion(v => v + 1))
      .on('postgres_changes', { event: '*', schema: 'api', table: 'treatments', filter: `patient_id=eq.${selectedPatient.id}` }, () => setHistoryVersion(v => v + 1))
      .subscribe()
    return () => { client.removeChannel(channel) }
  }, [selectedPatient?.id])

  // Reload latest tooth data on realtime bumps (so tabs reflect changes without manual reload)
  useEffect(() => {
    const run = async () => {
      if (!selectedPatient?.id) return
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .schema('api')
          .from('tooth_diagnoses')
          .select('tooth_number, status, primary_diagnosis, recommended_treatment, examination_date, notes, updated_at')
          .eq('patient_id', selectedPatient.id)
          .order('updated_at', { ascending: false })
        if (error) return
        const latestByTooth: Record<string, any> = {}
        for (const row of (data || [])) {
          const t = String((row as any).tooth_number)
          if (latestByTooth[t]) continue // keep first (latest)
          latestByTooth[t] = {
            currentStatus: (row as any).status || 'healthy',
            selectedDiagnoses: ((row as any).primary_diagnosis || '')?.split(',').map((s: string) => s.trim()).filter(Boolean),
            selectedTreatments: ((row as any).recommended_treatment || '')?.split(',').map((s: string) => s.trim()).filter(Boolean),
            diagnosisDetails: undefined,
            symptoms: [],
            priority: 'medium',
            duration: '',
            estimatedCost: '',
            scheduledDate: undefined,
            followUpRequired: false,
            examinationDate: (row as any).examination_date,
            treatmentNotes: (row as any).notes,
            diagnosticNotes: (row as any).notes
          }
        }
        setToothData(latestByTooth)
      } catch {}
    }
    run()
  }, [historyVersion, selectedPatient?.id])

  // Cleanup auto-save timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current)
    }
  }, [])

  // Live-sync diagnoses and treatments from the FDI chart into Diagnosis & Treatment tabs
  useEffect(() => {
    try {
      const diagSet = new Set<string>()
      const treatSet = new Set<string>()

      const normalizeTreatment = (name: string) => {
        const n = (name || '').toLowerCase()
        if (n.includes('filling')) return 'Dental filling'
        if (n.includes('extraction')) return 'Tooth extraction'
        if (n.includes('root canal') || n.includes('rct')) return 'Root canal therapy'
        if (n.includes('crown')) return 'Crown placement'
        if (n.includes('implant')) return 'Dental implant'
        if (n.includes('periodontal')) return 'Periodontal treatment'
        if (n.includes('orthodont')) return 'Orthodontic treatment'
        if (n.includes('cleaning') || n.includes('maintenance')) return 'Routine cleaning'
        return name
      }

      Object.values(toothData || {}).forEach((t: any) => {
        ;(t?.selectedDiagnoses || t?.diagnoses || [])?.forEach((d: string) => d && diagSet.add(d))
        ;(t?.selectedTreatments || t?.treatments || [])?.forEach((tr: string) => {
          if (!tr) return
          treatSet.add(normalizeTreatment(tr))
        })
      })

      const aggDiagnoses = Array.from(diagSet)
      const aggTreatments = Array.from(treatSet)

      const arraysEqual = (a: string[], b: string[]) => (
        a.length === b.length && a.every((v, i) => v === b[i])
      )

      setConsultationData(prev => {
        const next = { ...prev }
        let changed = false

        // Keep stable sorted order for deterministic comparison
        const prevDiag = [...prev.provisionalDiagnosis].sort()
        const nextDiag = [...aggDiagnoses].sort()
        if (!arraysEqual(prevDiag, nextDiag)) {
          next.provisionalDiagnosis = aggDiagnoses
          // Optionally reflect to finalDiagnosis if empty
          if (next.finalDiagnosis.length === 0) {
            next.finalDiagnosis = aggDiagnoses
          }
          changed = true
        }

        const prevTreat = [...prev.treatmentPlan].sort()
        const nextTreat = [...aggTreatments].sort()
        if (!arraysEqual(prevTreat, nextTreat)) {
          next.treatmentPlan = aggTreatments
          changed = true
        }

        return changed ? next : prev
      })
    } catch (e) {
      console.warn('Live sync from toothData failed:', e)
    }
  }, [toothData])

  const loadPreviousConsultationData = async (patientId: string) => {
    setIsLoadingConsultation(true)
    setLoadingError(null)
    try {
      console.log('🔍 Loading previous consultation data for patient:', patientId)
      const result = await loadPatientConsultationAction(patientId)
      if (!result) {
        console.warn('⚠️ No result returned from loadPatientConsultationAction')
        return
      }
      if ((result as any).error) {
        const errMsg = (result as any).error as string
        console.error('❌ Error loading consultation data:', errMsg)
        setLoadingError(`Failed to load consultation data: ${errMsg}`)
        return
      }
      if ((result as any).data) {
        const r: any = result
        console.log('✅ Found previous consultation data, loading...', {
          consultationId: r.data.consultation?.id,
          toothCount: r.data.toothData ? Object.keys(r.data.toothData).length : 0
        })
        setConsultationData(r.data.consultationData)
        setToothData(r.data.toothData || {})
        const toothCount = r.data.toothData ? Object.keys(r.data.toothData).length : 0
        if (toothCount > 0) {
          console.log(`✅ Previous consultation loaded with ${toothCount} teeth records`)
        } else {
          console.log('✅ Previous consultation loaded (no tooth data)')
        }
      } else {
        console.log('ℹ️ No previous consultation found for this patient - starting fresh')
      }
    } catch (error) {
      console.error('❌ Unexpected error loading consultation:', error)
      setLoadingError('An unexpected error occurred while loading consultation data')
    } finally {
      setIsLoadingConsultation(false)
    }
  }

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        if (!selectedPatient?.id) return
        const res = await getPatientToothDiagnoses(selectedPatient.id, null, true)
        if (res?.success) {
          const arr = Object.values(res.data || {}).map((d: any) => ({
            toothNumber: d.toothNumber,
            diagnoses: d.primaryDiagnosis ? [d.primaryDiagnosis] : [],
            treatments: d.recommendedTreatment ? [d.recommendedTreatment] : [],
            consultationDate: d.examinationDate || new Date().toISOString().split('T')[0],
            status: d.status
          }))
          setDiagnosisHistory(arr as any)
        } else if (res) {
          console.warn('History load failed:', res.error)
        }
      } catch (e) {
        console.warn('History load error:', e)
      }
    }
    fetchHistory()
  }, [selectedPatient?.id, historyVersion])

  const handlePatientSelect = async (patient: Patient) => {
    setSelectedPatient(patient)
    setConsultationData(prev => ({ ...prev, patientId: patient.id }))
    setSearchTerm("")
    setPatients([])
    onPatientSelect?.(patient)
    await loadPreviousConsultationData(patient.id)
  }

  const handleSaveConsultation = async (status: 'draft' | 'completed' = 'draft') => {
    if (!selectedPatient) return

    setIsSaving(true)
    try {
      console.log('💾 [SAVE] Starting consultation save...', {
        status,
        patientId: selectedPatient.id,
        toothDataCount: Object.keys(toothData).length,
        consultationData: consultationData,
        savedConsultationId
      })

      const result = await finalizeConsultationFromDraftAction({
        consultationId: savedConsultationId || undefined,
        patientId: selectedPatient.id,
        consultationData: consultationData,
        toothData: toothData,
        status,
        appointmentId: appointmentId || undefined
      })

      if (!result.success) {
        const msg = result.error || 'Failed to save consultation'
        console.error('❌ [SAVE] Error:', msg)
        alert(msg)
        return
      }

      const newId = result.data?.id
      if (newId) setSavedConsultationId(newId)

      const statusText = status === 'draft' ? 'draft saved' : 'completed'
      alert(`Consultation ${statusText} successfully!`)

      if (status === 'completed') {
        setIsConsultationCompleted(true)
        console.log('🎯 [CONSULTATION] Completed - showing appointment request option')
      }
    } catch (error) {
      console.error('❌ [SAVE] Unexpected error:', error)
      alert('An unexpected error occurred while saving. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const getPatientAge = (dateOfBirth?: string | null): number | null => {
    if (!dateOfBirth) return null
    const dob = new Date(dateOfBirth)
    if (Number.isNaN(dob.getTime())) return null
    return differenceInYears(new Date(), dob)
  }

  const formatDOB = (dateOfBirth?: string | null): string | null => {
    if (!dateOfBirth) return null
    const dob = new Date(dateOfBirth)
    if (Number.isNaN(dob.getTime())) return null
    return format(dob, 'MMM d, yyyy')
  }

  const navigateToNextTab = () => {
    const sections = getConsultationSections()
    const currentIndex = sections.findIndex(s => s.id === activeSection)
    if (currentIndex < sections.length - 1) {
      setActiveSection(sections[currentIndex + 1].id)
    }
  }

  const navigateToPreviousTab = () => {
    const sections = getConsultationSections()
    const currentIndex = sections.findIndex(s => s.id === activeSection)
    if (currentIndex > 0) {
      setActiveSection(sections[currentIndex - 1].id)
    }
  }

  const getCurrentTabInfo = () => {
    const sections = getConsultationSections()
    const currentIndex = sections.findIndex(s => s.id === activeSection)
    return {
      current: currentIndex + 1,
      total: sections.length,
      hasNext: currentIndex < sections.length - 1,
      hasPrevious: currentIndex > 0,
      section: sections[currentIndex]
    }
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!activeSection) return
      const activeElement = document.activeElement
      const isInputFocused = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA'
      if (!isInputFocused) {
        if (event.key === 'ArrowRight' && getCurrentTabInfo().hasNext) {
          event.preventDefault()
          navigateToNextTab()
        } else if (event.key === 'ArrowLeft' && getCurrentTabInfo().hasPrevious) {
          event.preventDefault()
          navigateToPreviousTab()
        } else if (event.key === 'Escape') {
          event.preventDefault()
          setActiveSection(null)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeSection])

  const handleTabSave = async (sectionId: string, tabData: any) => {
    if (!selectedPatient) return

    try {
      console.log(`💾 Saving ${sectionId} data:`, tabData)
      // Update local state immediately
      updateConsultationFromTabData(sectionId, tabData)

      // Persist this section into JSONB (draft)
      const result = await saveConsultationSectionAction({
        patientId: selectedPatient.id,
        consultationId: savedConsultationId || undefined,
        sectionId,
        sectionData: tabData
      })

      if (!result.success) {
        throw new Error(result.error || 'Section save failed')
      }

      if (result.consultationId && result.consultationId !== savedConsultationId) {
        setSavedConsultationId(result.consultationId)
      }

      console.log(`✅ ${sectionId} saved to JSONB draft`)
      alert(`${sectionId} section saved!`)
    } catch (error: any) {
      console.error(`❌ Error saving ${sectionId}:`, error)
      alert(`Failed to save ${sectionId}: ${error.message}`)
    }
  }

  if (!selectedPatient) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Consultation (V3)</h1>
          <p className="text-gray-600">Search and select a patient to begin consultation</p>
        </div>
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
                          {getPatientAge(patient.date_of_birth) !== null ? `${getPatientAge(patient.date_of_birth)} years` : 'Age N/A'}
                        </p>
                        <Badge variant="outline" className="text-xs">Active</Badge>
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
                <p>Please search and select a patient to begin the consultation.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setSelectedPatient(null)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Patient Search
            </Button>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">
            New Consultation: {selectedPatient.first_name} {selectedPatient.last_name}
          </h1>
          <p className="text-gray-600">Complete consultation by clicking on each section below</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleSaveConsultation('draft')}
            disabled={isSaving}
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Draft'}
          </Button>
          <Button
            className="bg-teal-600 hover:bg-teal-700"
            onClick={() => handleSaveConsultation('completed')}
            disabled={isSaving}
          >
            <Send className="w-4 h-4 mr-2" />
            {isSaving ? 'Completing...' : 'Complete Consultation'}
          </Button>
          {isConsultationCompleted && savedConsultationId && (
            <AppointmentRequestDialog
              consultationId={savedConsultationId}
              patientId={selectedPatient.id}
              patientName={`${selectedPatient.first_name} ${selectedPatient.last_name}`}
              trigger={
                <Button
                  variant="outline"
                  className="border-teal-600 text-teal-600 hover:bg-teal-50"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Request Appointment
                </Button>
              }
              onSuccess={() => {
                console.log('🎯 [APPOINTMENT] Request created successfully from consultation')
                setTimeout(() => {
                  setSelectedPatient(null)
                  setToothData({})
                  setIsConsultationCompleted(false)
                  setSavedConsultationId(null)
                  setConsultationData({
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
                    finalDiagnosis: [],
                    treatmentPlan: [],
                    prognosis: '',
                    prescriptions: [],
                    followUpPlans: [],
                    additionalNotes: ''
                  })
                }, 2000)
              }}
            />
          )}
        </div>
      </div>

      <Card className="border-l-4 border-l-teal-600">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h3 className="font-semibold">{selectedPatient.first_name} {selectedPatient.last_name}</h3>
                <p className="text-sm text-gray-600">UHID: UH{selectedPatient.id.slice(-6)}</p>
              </div>
              <div className="text-sm text-gray-600">
                <p>Age: {(() => { const age = getPatientAge(selectedPatient.date_of_birth); return age !== null ? `${age} years` : '—' })()}</p>
                <p>DOB: {formatDOB(selectedPatient.date_of_birth) ?? '—'}</p>
              </div>
              {isLoadingConsultation && (
                <div className="flex items-center gap-2 text-blue-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="text-sm">Loading previous data...</span>
                </div>
              )}
              {loadingError && (
                <div className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm">{loadingError}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-2"
                    onClick={() => loadPreviousConsultationData(selectedPatient.id)}
                    disabled={isLoadingConsultation}
                  >
                    Retry
                  </Button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selectedPatient.medical_history_summary && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Medical Alert
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-r from-blue-50 to-teal-50 border-blue-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-blue-700 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Consultation Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            const sections = getConsultationSections()
            const completedSections = sections.filter(s => s.status === 'complete').length
            const partialSections = sections.filter(s => s.status === 'partial').length
            const emptySections = sections.filter(s => s.status === 'empty').length
            const progressPercentage = Math.round((completedSections / sections.length) * 100)
            return (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                    <span className="text-sm text-gray-500">{completedSections}/{sections.length} sections completed</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-teal-500 to-blue-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${progressPercentage}%` }}
                    ></div>
                  </div>
                  <div className="text-right text-xs text-gray-500 mt-1">{progressPercentage}% complete</div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{completedSections}</div>
                    <div className="text-xs text-gray-600">Completed</div>
                    <div className="w-full bg-green-100 rounded-full h-1 mt-1">
                      <div className="bg-green-500 h-1 rounded-full" style={{ width: '100%' }}></div>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">{partialSections}</div>
                    <div className="text-xs text-gray-600">In Progress</div>
                    <div className="w-full bg-yellow-100 rounded-full h-1 mt-1">
                      <div className="bg-yellow-500 h-1 rounded-full" style={{ width: partialSections > 0 ? '100%' : '0%' }}></div>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-600">{emptySections}</div>
                    <div className="text-xs text-gray-600">Remaining</div>
                    <div className="w-full bg-gray-100 rounded-full h-1 mt-1">
                      <div className="bg-gray-400 h-1 rounded-full" style={{ width: emptySections > 0 ? '100%' : '0%' }}></div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-blue-200">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span>
                      {progressPercentage < 25 ? 'Just getting started' :
                       progressPercentage < 50 ? 'Making good progress' :
                       progressPercentage < 75 ? 'Almost halfway there' :
                       progressPercentage < 100 ? 'Nearly complete!' :
                       'Consultation complete!'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {emptySections > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {emptySections} sections remaining
                      </Badge>
                    )}
                    {progressPercentage === 100 && (
                      <Badge className="bg-green-100 text-green-800 text-xs">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Ready to complete!
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )
          })()}
        </CardContent>
      </Card>

      <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-teal-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg text-blue-700">Interactive FDI Dental Chart</CardTitle>
              <p className="text-sm text-gray-600 mt-1">Click on any tooth to add diagnosis and treatment plan</p>
            </div>
            {selectedTooth && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                Tooth #{selectedTooth} Selected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <InteractiveDentalChart
            onToothSelect={(toothNumber) => {
              console.log('🦷 Tooth selected:', toothNumber)
              setSelectedTooth(toothNumber)
              setShowToothInterface(true)
            }}
            selectedTooth={selectedTooth}
            patientId={selectedPatient?.id}
            consultationId={undefined}
            multiSelectMode={true}
            toothData={toothData}
            // Chart-driven: listen to DB changes and allow DB loads even with external data
            subscribeRealtime={true}
            allowDbLoadWithExternal={true}
            onToothStatusChange={(toothNumber, status, data) => {
              console.log('🦷 Right-click status change:', { toothNumber, status, data })
              // Update the local toothData state with the new data (live UI feedback)
              setToothData(prev => ({
                ...prev,
                [toothNumber]: data
              }))
            }}
          />
          <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-teal-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-blue-700">🦷 Real-time Dental Chart Data</h3>
              <Badge className="bg-blue-100 text-blue-800 text-xs">
                {Object.keys(toothData).length} Teeth with Data
              </Badge>
            </div>
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-medium text-gray-600 mb-2 block">Upper Jaw (Maxilla)</Label>
                <div className="grid grid-cols-8 gap-1">
                  {[18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28].map(toothNum => {
                    const toothInfo = (toothData as any)[toothNum.toString()]
                    const hasData = !!toothInfo
                    const isSelected = selectedTooth === toothNum.toString()
                    return (
                      <div
                        key={toothNum}
                        className={`p-2 rounded text-center border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-purple-400 bg-purple-100 ring-2 ring-purple-300'
                            : hasData
                            ? 'border-blue-300 bg-blue-100 hover:bg-blue-200'
                            : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                        }`}
                        onClick={() => {
                          setSelectedTooth(toothNum.toString())
                          setShowToothInterface(true)
                        }}
                      >
                        <div className="text-xs font-bold text-gray-700">#{toothNum}</div>
                        {hasData && (
                          <div className="space-y-1 mt-1">
                            {toothInfo.selectedDiagnoses?.length > 0 && (
                              <div className="text-xs bg-orange-100 text-orange-700 px-1 rounded">
                                {toothInfo.selectedDiagnoses.length}D
                              </div>
                            )}
                            {toothInfo.selectedTreatments?.length > 0 && (
                              <div className="text-xs bg-green-100 text-green-700 px-1 rounded">
                                {toothInfo.selectedTreatments.length}T
                              </div>
                            )}
                            {toothInfo.currentStatus && toothInfo.currentStatus !== 'healthy' && (
                              <div className={`text-xs px-1 rounded ${
                                toothInfo.currentStatus === 'caries' ? 'bg-red-100 text-red-700' :
                                toothInfo.currentStatus === 'filled' ? 'bg-blue-100 text-blue-700' :
                                toothInfo.currentStatus === 'missing' ? 'bg-gray-100 text-gray-700' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>
                                {toothInfo.currentStatus.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600 mb-2 block">Lower Jaw (Mandible)</Label>
                <div className="grid grid-cols-8 gap-1">
                  {[48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38].map(toothNum => {
                    const toothInfo = (toothData as any)[toothNum.toString()]
                    const hasData = !!toothInfo
                    const isSelected = selectedTooth === toothNum.toString()
                    return (
                      <div
                        key={toothNum}
                        className={`p-2 rounded text-center border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-purple-400 bg-purple-100 ring-2 ring-purple-300'
                            : hasData
                            ? 'border-blue-300 bg-blue-100 hover:bg-blue-200'
                            : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                        }`}
                        onClick={() => {
                          setSelectedTooth(toothNum.toString())
                          setShowToothInterface(true)
                        }}
                      >
                        <div className="text-xs font-bold text-gray-700">#{toothNum}</div>
                        {hasData && (
                          <div className="space-y-1 mt-1">
                            {toothInfo.selectedDiagnoses?.length > 0 && (
                              <div className="text-xs bg-orange-100 text-orange-700 px-1 rounded">
                                {toothInfo.selectedDiagnoses.length}D
                              </div>
                            )}
                            {toothInfo.selectedTreatments?.length > 0 && (
                              <div className="text-xs bg-green-100 text-green-700 px-1 rounded">
                                {toothInfo.selectedTreatments.length}T
                              </div>
                            )}
                            {toothInfo.currentStatus && toothInfo.currentStatus !== 'healthy' && (
                              <div className={`text-xs px-1 rounded ${
                                toothInfo.currentStatus === 'caries' ? 'bg-red-100 text-red-700' :
                                toothInfo.currentStatus === 'filled' ? 'bg-blue-100 text-blue-700' :
                                toothInfo.currentStatus === 'missing' ? 'bg-gray-100 text-gray-700' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>
                                {toothInfo.currentStatus.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="pt-3 border-t border-blue-200">
                <div className="flex items-center justify-center gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 bg-orange-100 border border-orange-200 rounded"></div>
                    <span className="text-gray-600">D = Diagnoses</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 bg-green-100 border border-green-200 rounded"></div>
                    <span className="text-gray-600">T = Treatments</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 bg-purple-100 border border-purple-200 rounded"></div>
                    <span className="text-gray-600">Selected</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <GlobalVoiceRecorder
        consultationId={selectedPatient.id}
        onContentProcessed={(content) => {
          console.log('🎤 Processed voice content:', content)
          distributeContentToTabs(content)
        }}
        isEnabled={true}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {getConsultationSections().map((section) => {
          const sectionValidation = getSectionValidation(section.id)
          const hasValidationIssues = !sectionValidation.isValid ||
            (sectionValidation.warnings && sectionValidation.warnings.length > 0)

          return (
            <Card
              key={section.id}
              className={`cursor-pointer transition-all duration-200 hover:shadow-lg border-2 ${getStatusColor(section.status)} ${
                hasValidationIssues && section.status === 'complete' ? 'ring-2 ring-yellow-400' : ''
              }`}
              onClick={() => setActiveSection(section.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {section.icon}
                    <CardTitle className="text-sm">{section.title}</CardTitle>
                    {hasValidationIssues && section.status === 'complete' && (
                      <AlertTriangle className="w-3 h-3 text-yellow-500" title="Has validation warnings" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(section.status)}
                    {section.voiceEnabled && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (voiceSession.isActive && voiceSession.sectionId === section.id) {
                            stopVoiceSession()
                          } else {
                            startVoiceSession(section.id)
                          }
                        }}
                      >
                        {voiceSession.isActive && voiceSession.sectionId === section.id ? (
                          <MicOff className="w-4 h-4 text-red-500" />
                        ) : (
                          <Mic className="w-4 h-4 text-gray-400 hover:text-blue-500" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-gray-600 mb-3">{section.description}</p>
                <div className="space-y-1">
                  <div className={`text-xs px-2 py-1 rounded ${getStatusColor(section.status)}`}>
                    {section.status === 'empty' && 'Click to start'}
                    {section.status === 'partial' && 'In progress'}
                    {section.status === 'complete' && 'Completed'}
                  </div>
                  {hasValidationIssues && section.status === 'complete' && (
                    <div className="text-xs text-yellow-600 mt-1">
                      {!sectionValidation.isValid ? 'Has validation errors' : 'Has warnings'}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Dialog open={!!activeSection} onOpenChange={() => setActiveSection(null)}>
        <DialogContent className="max-w-4xl h-[90vh] overflow-hidden">
          <DialogHeader className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={navigateToPreviousTab}
                  disabled={!getCurrentTabInfo().hasPrevious}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>{getCurrentTabInfo().current} of {getCurrentTabInfo().total}</span>
                  <div className="w-20 bg-gray-200 rounded-full h-1">
                    <div
                      className="bg-teal-600 h-1 rounded-full transition-all duration-300"
                      style={{ width: `${(getCurrentTabInfo().current / getCurrentTabInfo().total) * 100}%` }}
                    ></div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={navigateToNextTab}
                  disabled={!getCurrentTabInfo().hasNext}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveSection(null)}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getConsultationSections().find(s => s.id === activeSection)?.icon}
                <span>{getConsultationSections().find(s => s.id === activeSection)?.title}</span>
                <div className={`text-xs px-2 py-1 rounded ${getStatusColor(getCurrentTabInfo().section?.status as any)}`}>
                  {getCurrentTabInfo().section?.status === 'empty' && 'Not Started'}
                  {getCurrentTabInfo().section?.status === 'partial' && 'In Progress'}
                  {getCurrentTabInfo().section?.status === 'complete' && 'Completed'}
                </div>
              </div>
              {getConsultationSections().find(s => s.id === activeSection)?.voiceEnabled && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (voiceSession.isActive && voiceSession.sectionId === activeSection) {
                      stopVoiceSession()
                    } else if (activeSection) {
                      startVoiceSession(activeSection)
                    }
                  }}
                >
                  {voiceSession.isActive && voiceSession.sectionId === activeSection ? (
                    <>
                      <MicOff className="w-4 h-4 mr-2" />
                      Stop Recording
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4 mr-2" />
                      Start Voice Input
                    </>
                  )}
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-4">
            {activeSection && (() => {
              const section = getConsultationSections().find(s => s.id === activeSection)
              if (section?.component) {
                const TabComponent = section.component
                const getDefaultData = () => {
                  // If the rendered component is an overview (diagnosis/treatment), it expects toothData
                  if (section?.component === DiagnosisOverviewTab || section?.component === TreatmentOverviewTab) {
                    return toothData
                  }
                  switch (activeSection) {
                    case 'chief-complaint':
                      return {
                        primary_complaint: consultationData.chiefComplaint || '',
                        onset_duration: consultationData.painDuration || '',
                        associated_symptoms: consultationData.painTriggers || [],
                        severity_scale: consultationData.painIntensity || 0,
                        location_detail: consultationData.painLocation || '',
                        patient_description: consultationData.chiefComplaint || '',
                        onset_type: consultationData.painCharacter || '',
                        pain_scale: consultationData.painIntensity || 0,
                        frequency: consultationData.painDuration || '',
                        triggers: consultationData.painTriggers || []
                      }
                    case 'hopi':
                      return {
                        pain_characteristics: {
                          quality: consultationData.painCharacter || '',
                          intensity: consultationData.painIntensity || 0,
                          frequency: '',
                          duration: consultationData.painDuration || ''
                        },
                        // Provide saved onset details and duration as simple strings
                        onset_details: consultationData.hopiOnsetDetails || '',
                        duration: consultationData.painDuration || '',
                        aggravating_factors: consultationData.painTriggers || [],
                        relieving_factors: consultationData.painRelief || [],
                        associated_symptoms: [],
                        previous_episodes: '',
                        previous_treatments: [],
                        response_to_treatment: '',
                        chronology: '',
                        pattern_changes: '',
                        impact_on_daily_life: []
                      }
                    case 'medical-history':
                      return {
                        // Match MedicalHistoryTab prop names
                        medical_conditions: consultationData.medicalHistory || [],
                        current_medications: consultationData.currentMedications || [],
                        allergies: consultationData.allergies || [],
                        previous_dental_treatments: consultationData.previousDentalTreatments || [],
                        family_medical_history: '',
                        additional_notes: consultationData.additionalNotes || ''
                      }
                    case 'personal-history':
                      // Provide data matching PersonalHistoryTab interface
                      return consultationData.personalHistory || {
                        smoking: { status: 'never', duration: '', quantity: '', type: '', quit_date: '' },
                        alcohol: { status: 'never', frequency: '', quantity: '', type: [] },
                        tobacco: { status: 'never', type: [], duration: '', frequency: '', quit_date: '' },
                        dietary_habits: [],
                        oral_hygiene: {
                          brushing_frequency: '',
                          brushing_technique: '',
                          flossing: '',
                          mouthwash: '',
                          last_cleaning: '',
                          toothbrush_type: '',
                          fluoride_exposure: []
                        },
                        other_habits: [],
                        exercise_habits: '',
                        sleep_patterns: '',
                        stress_levels: '',
                        occupation: '',
                        occupational_hazards: [],
                        lifestyle_factors: []
                      }
                    case 'clinical-examination':
                      // Provide flattened values compatible with checkbox-based tab
                      return {
                        extraoral_findings: consultationData.extraoralFindings || '',
                        intraoral_findings: consultationData.intraoralFindings || '',
                        oral_hygiene: consultationData.oralHygieneStatus || '',
                        gingival_condition: consultationData.gingivalCondition || '',
                        periodontal_status: consultationData.periodontalStatus || '',
                        occlusion_notes: consultationData.occlusionNotes || ''
                      }
                    case 'investigations':
                      // Provide flattened keys that InvestigationsTab expects
                      return {
                        radiographic_findings: consultationData.radiographicFindings || '',
                        radiographic_types: consultationData.radiographicTypes || [],
                        vitality_tests: (consultationData.vitalityTests || '').split(/;|,|\n/).map(s => s.trim()).filter(Boolean),
                        percussion_tests: (consultationData.percussionTests || '').split(/;|,|\n/).map(s => s.trim()).filter(Boolean),
                        palpation_findings: (consultationData.palpationFindings || '').split(/;|,|\n/).map(s => s.trim()).filter(Boolean),
                        laboratory_tests: consultationData.laboratoryTests || '',
                        recommendations: consultationData.investigationRecommendations || ''
                      }
                    case 'clinical-diagnosis':
                      return {
                        // Pass strings to the tab component for its textareas
                        provisional_diagnosis: (consultationData.provisionalDiagnosis || []).join(', '),
                        differential_diagnoses: (consultationData.differentialDiagnosis || []).join(', '),
                        final_diagnosis: (consultationData.finalDiagnosis || []).join(', '),
                        tooth_specific_diagnoses: {},
                        clinical_impression: '',
                        diagnostic_reasoning: '',
                        further_investigations_needed: false,
                        consultation_required: false,
                        specialist_referral: {
                          required: false,
                          specialty: '',
                          reason: ''
                        }
                      }
                    case 'treatment-plan':
                      return {
                        // Provide the exact keys expected by TreatmentPlanTab
                        treatment_goals: '',
                        planned_procedures: consultationData.treatmentPlan || [],
                        treatment_sequence: '',
                        estimated_duration: '',
                        treatment_options: '',
                        risk_considerations: '',
                        follow_up_plan: '',
                        prognosis: consultationData.prognosis || ''
                      }
                    case 'prescription':
                      return {
                        medications: [],
                        general_instructions: '',
                        tooth_specific_prescriptions: {},
                        allergies_checked: false,
                        drug_interactions_checked: false,
                        follow_up_required: false,
                        pharmacist_notes: ''
                      }
                    case 'follow-up':
                      // Provide saved follow-up object if available; otherwise defaults
                      return (consultationData.followUpPlans && !Array.isArray(consultationData.followUpPlans)) ?
                        consultationData.followUpPlans : {
                          appointments: [],
                          post_care_instructions: [],
                          tooth_specific_follow_ups: {},
                          general_follow_up_notes: '',
                          next_visit_required: false,
                          emergency_contact_provided: false,
                          patient_education_completed: false,
                          recall_period: ''
                        }
                    case 'clinical-diagnosis':
                      return toothData
                    case 'treatment-plan':
                      return toothData
                    case 'diagnosis-overview':
                      return {
                        // Provide the exact keys expected by DiagnosisTab
                        provisional_diagnosis: (consultationData.provisionalDiagnosis || []).join(', '),
                        differential_diagnoses: (consultationData.differentialDiagnosis || []).join(', '),
                        final_diagnosis: (consultationData.finalDiagnosis || []).join(', '),
                        clinical_impression: '',
                        diagnostic_reasoning: '',
                        prognosis: consultationData.prognosis || ''
                      }
                    case 'treatment-overview':
                      return {
                        // Provide the exact keys expected by TreatmentPlanTab
                        treatment_goals: '',
                        planned_procedures: consultationData.treatmentPlan || [],
                        treatment_sequence: '',
                        estimated_duration: '',
                        treatment_options: '',
                        risk_considerations: '',
                        follow_up_plan: '',
                        prognosis: consultationData.prognosis || ''
                      }
                    default:
                      return {}
                  }
                }

                const isDiagnosisOverview = (TabComponent === DiagnosisOverviewTab)
                const isDiagnosisOverviewLive = (TabComponent === DiagnosisOverviewTabLive)
                const isTreatmentOverview = (TabComponent === TreatmentOverviewTab)
                const isTreatmentOverviewLive = (TabComponent === TreatmentOverviewTabLive)
                const isFollowUpOverview = (TabComponent === FollowUpOverviewTab)
                
                // showHistory only for Overview tabs (id/title contains 'overview')
                const includeHistoryForDiag = (section as any)?.showHistory ?? (/overview/i.test(section?.id || '') || /overview/i.test(section?.title || ''))
                const overviewProps = isDiagnosisOverview ? {
                  consultationData: {
                    clinicianName: 'Dr. ' + (selectedPatient?.first_name || 'Dentist'),
                    patientName: `${selectedPatient?.first_name || ''} ${selectedPatient?.last_name || ''}`.trim(),
                    consultationDate: new Date().toISOString().split('T')[0]
                  },
                  showHistory: includeHistoryForDiag,
                  history: includeHistoryForDiag ? (diagnosisHistory || []).map(h => ({
                    toothNumber: h.toothNumber,
                    diagnoses: h.diagnoses,
                    treatments: h.treatments,
                    diagnosisDate: h.consultationDate,
                    clinicianName: undefined,
                    status: h.status
                  })) : undefined,
                  extraDefaults: !includeHistoryForDiag ? {
                    provisional: (consultationData.provisionalDiagnosis || []).join(', '),
                    differential: (consultationData.differentialDiagnosis || []).join(', '),
                    final: (consultationData.finalDiagnosis || []).join(', ')
                  } : undefined,
                  onChange: (payload: any) => {
                    updateConsultationFromTabData('clinical-diagnosis', payload)
                    queueAutoSaveSection('clinical-diagnosis', payload)
                  }
                } : {}

                const includeHistoryForTreat = (section as any)?.showHistory ?? (/overview/i.test(section?.id || '') || /overview/i.test(section?.title || ''))
                const treatmentProps = isTreatmentOverview ? {
                  consultationData: {
                    clinicianName: 'Dr. ' + (selectedPatient?.first_name || 'Dentist'),
                    patientName: `${selectedPatient?.first_name || ''} ${selectedPatient?.last_name || ''}`.trim(),
                    consultationDate: new Date().toISOString().split('T')[0]
                  },
                  showHistory: includeHistoryForTreat,
                  history: includeHistoryForTreat ? (diagnosisHistory || []).map(h => ({
                    toothNumber: h.toothNumber,
                    treatments: h.treatments,
                    diagnosisDate: h.consultationDate,
                    clinicianName: undefined,
                    status: h.status
                  })) : undefined,
                  extraDefaults: { prognosis: consultationData.prognosis || '' },
                  onChange: (payload: any) => {
                    updateConsultationFromTabData('treatment-plan', payload)
                    queueAutoSaveSection('treatment-plan', payload)
                  }
                } : {}

                // Special handling for TreatmentOverviewTabLive
                if (isTreatmentOverviewLive) {
                  return (
                    <div
                      key={activeSection}
                      className="animate-in fade-in-50 slide-in-from-bottom-2 duration-300"
                    >
                      <TabComponent
                        patientId={selectedPatient?.id || ''}
                        consultationId={savedConsultationId || undefined}
                        data={toothData}
                        isReadOnly={false}
                        onChange={(data: any) => {
                          console.log(`🔄 [PARENT] ${section?.title} onChange triggered with:`, data)
                          updateConsultationFromTabData(activeSection as string, data)
                          if (activeSection) queueAutoSaveSection(activeSection, data)
                        }}
                      />
                    </div>
                  )
                }

                // Special handling for FollowUpOverviewTab
                if (isFollowUpOverview) {
                  return (
                    <div
                      key={activeSection}
                      className="animate-in fade-in-50 slide-in-from-bottom-2 duration-300"
                    >
                      <TabComponent
                        patientId={selectedPatient?.id || ''}
                        consultationId={savedConsultationId || undefined}
                        dentistId={dentistId || ''}
                        isReadOnly={false}
                      />
                    </div>
                  )
                }

                const defaultData = getDefaultData()
                console.log(`🔍 [PARENT] Rendering ${section?.title} with data:`, defaultData)
                console.log(`🦷 [PARENT] Current toothData:`, toothData)
                console.log(`🔍 [PARENT] Active section:`, activeSection)
                return (
                  <div
                    key={activeSection}
                    className="animate-in fade-in-50 slide-in-from-bottom-2 duration-300"
                  >
                    <TabComponent
                      data={defaultData}
                      onChange={(data: any) => {
                        console.log(`🔄 [PARENT] ${section?.title} onChange triggered with:`, data)
                        updateConsultationFromTabData(activeSection as string, data)
                        if (activeSection) queueAutoSaveSection(activeSection, data)
                      }}
                      isReadOnly={false}
                      onSave={(data: any) => {
                        console.log(`💾 [PARENT] ${section?.title} onSave triggered with:`, data)
                        return handleTabSave(activeSection as string, data)
                      }}
                      patientId={selectedPatient?.id}
                      consultationId={savedConsultationId || undefined}
                      {...overviewProps}
                      {...treatmentProps}
                    />
                  </div>
                )
              }

              return (
                <div className="space-y-6">
                  <div className="text-center py-8">
                    <h3 className="text-lg font-semibold mb-2">{section?.title}</h3>
                    <p className="text-gray-500">This section is under development.</p>
                    <p className="text-sm text-gray-400 mt-2">Section ID: {activeSection}</p>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor={`${activeSection}-notes`}>Notes</Label>
                      <Textarea
                        id={`${activeSection}-notes`}
                        placeholder={`Enter ${section?.title?.toLowerCase()} details...`}
                        className="mt-1"
                        rows={6}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setActiveSection(null)}>
                        Cancel
                      </Button>
                      <Button>
                        Save {section?.title}
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        </DialogContent>
      </Dialog>

      <ToothDiagnosisDialogV2
        isOpen={showToothInterface}
        onClose={() => {
          setShowToothInterface(false)
          setSelectedTooth(null)
        }}
        toothNumber={selectedTooth || ''}
        patientId={selectedPatient?.id}
        consultationId={savedConsultationId || undefined}
        existingData={toothData[selectedTooth || '']}
        onDataSaved={() => {
          console.log('💾 Tooth diagnosis saved for tooth', selectedTooth)
          // Reload tooth data after saving
          if (selectedPatient?.id) {
            // You might want to refresh the tooth data here
            setShowToothInterface(false)
          }
        }}
      />
    </div>
  )
}
