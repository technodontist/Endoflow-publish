'use client'

import { useState, useEffect } from 'react'
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
import { ChiefComplaintTab } from '@/components/consultation/tabs/ChiefComplaintTab'
import { HOPITab } from '@/components/consultation/tabs/HOPITab'
import { MedicalHistoryTab } from '@/components/consultation/tabs/MedicalHistoryTab'
import { PersonalHistoryTab } from '@/components/consultation/tabs/PersonalHistoryTab'
import { ClinicalExaminationTab } from '@/components/consultation/tabs/ClinicalExaminationTab'
import { InvestigationsTab } from '@/components/consultation/tabs/InvestigationsTab'
import { FollowUpTab } from '@/components/consultation/tabs/FollowUpTab'
import { PrescriptionTab } from '@/components/consultation/tabs/PrescriptionTab'
import { DiagnosisTab } from '@/components/consultation/tabs/DiagnosisTab'
import { DiagnosisOverviewTab } from '@/components/consultation/tabs/DiagnosisOverviewTab'
import { TreatmentPlanTab } from '@/components/consultation/tabs/TreatmentPlanTab'
import { TreatmentOverviewTab } from '@/components/consultation/tabs/TreatmentOverviewTab'
import { GlobalVoiceRecorder } from '@/components/consultation/GlobalVoiceRecorder'
import { SimpleToothInterface } from '@/components/consultation/SimpleToothInterface'
import { saveCompleteConsultationAction, loadPatientConsultationAction, saveConsultationSectionAction } from '@/lib/actions/consultation'
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
  followUpPlans: any[]

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
  onPatientSelect?: (patient: Patient) => void
}

export function EnhancedNewConsultation({ selectedPatientId, onPatientSelect }: EnhancedNewConsultationProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null)
  const [showToothInterface, setShowToothInterface] = useState(false)
  const [toothData, setToothData] = useState<{[key: string]: any}>({})
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
    finalDiagnosis: [],
    treatmentPlan: [],
    prognosis: '',
    prescriptions: [],
    followUpPlans: [],
    additionalNotes: ''
  })

  // Define consultation sections with their current status
  const getConsultationSections = (): ConsultationSection[] => [
    {
      id: 'chief-complaint',
      title: 'Chief Complaint',
      icon: <AlertTriangle className="w-5 h-5" />,
      status: getSectionStatus('chief-complaint'),
      description: 'Primary concern, pain assessment',
      data: {
        chiefComplaint: consultationData.chiefComplaint,
        painLocation: consultationData.painLocation,
        painIntensity: consultationData.painIntensity,
        painDuration: consultationData.painDuration
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
        painCharacter: consultationData.painCharacter,
        painTriggers: consultationData.painTriggers,
        painRelief: consultationData.painRelief
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
      description: 'Provisional, differential and final diagnosis',
      data: {
        provisionalDiagnosis: consultationData.provisionalDiagnosis,
        differentialDiagnosis: consultationData.differentialDiagnosis,
        finalDiagnosis: consultationData.finalDiagnosis
      },
      voiceEnabled: true,
      component: DiagnosisTab
    },
    {
      id: 'treatment-plan',
      title: 'Treatment Plan',
      icon: <CheckCircle className="w-5 h-5" />,
      status: getSectionStatus('treatment-plan'),
      description: 'Treatment planning and prognosis',
      data: {
        treatmentPlan: consultationData.treatmentPlan,
        prognosis: consultationData.prognosis
      },
      voiceEnabled: true,
      component: TreatmentPlanTab
    },
    {
      id: 'prescription',
      title: 'Prescription',
      icon: <Pill className="w-5 h-5" />,
      status: getSectionStatus('prescription'),
      description: 'Medications and prescriptions',
      data: {
        prescriptions: consultationData.prescriptions
      },
      voiceEnabled: false,
      component: PrescriptionTab
    },
    {
      id: 'follow-up',
      title: 'Follow-up',
      icon: <Calendar className="w-5 h-5" />,
      status: getSectionStatus('follow-up'),
      description: 'Follow-up appointments and care',
      data: {
        followUpPlans: consultationData.followUpPlans
      },
      voiceEnabled: false,
      component: FollowUpTab
    },
    {
      id: 'diagnosis-overview',
      title: 'Diagnosis Overview',
      icon: <AlertTriangle className="w-5 h-5" />,
      status: getSectionStatus('diagnosis-overview'),
      description: 'Tabular view of all diagnoses',
      data: toothData,
      voiceEnabled: false,
      component: DiagnosisOverviewTab
    },
    {
      id: 'treatment-overview',
      title: 'Treatment Overview',
      icon: <CheckCircle className="w-5 h-5" />,
      status: getSectionStatus('treatment-overview'),
      description: 'Tabular view of all treatments',
      data: toothData,
      voiceEnabled: false,
      component: TreatmentOverviewTab
    }
  ]

  // Simple validation placeholder
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
        const personalFields = [consultationData.previousDentalTreatments]
        if (personalFields.every(field => field.length === 0)) return 'empty'
        return personalFields.some(field => field.length > 0) ? 'complete' : 'empty'

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

      case 'follow-up':
        return consultationData.followUpPlans.length > 0 ? 'complete' : 'empty'

      case 'diagnosis-overview':
        const teethWithDiagnoses = Object.values(toothData).filter(tooth => tooth.selectedDiagnoses?.length > 0)
        return teethWithDiagnoses.length > 0 ? 'complete' : 'empty'

      case 'treatment-overview':
        const teethWithTreatments = Object.values(toothData).filter(tooth => tooth.selectedTreatments?.length > 0)
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

      // TODO: Integrate with N8N webhook for voice processing
      console.log(`🎤 Started voice session for section: ${sectionId}`)

      // Simulate voice recording (replace with actual implementation)
      // This would connect to browser's speech recognition API and N8N

    } catch (error) {
      console.error('Error starting voice session:', error)
      setVoiceSession({ isActive: false, sectionId: null, transcript: '', startTime: null })
    }
  }

  const stopVoiceSession = async () => {
    try {
      console.log(`🛑 Stopped voice session for section: ${voiceSession.sectionId}`)

      // TODO: Send transcript to N8N for AI processing
      // Process the voice data and populate the appropriate section

      setVoiceSession({ isActive: false, sectionId: null, transcript: '', startTime: null })
    } catch (error) {
      console.error('Error stopping voice session:', error)
    }
  }

  const distributeContentToTabs = (processedContent: any) => {
    console.log('🎯 Distributing AI-processed content to consultation tabs...')

    try {
      // Update consultation data based on AI-processed content
      setConsultationData(prev => {
        const updated = { ...prev }

        // Chief Complaint Distribution
        if (processedContent.chiefComplaint) {
          const cc = processedContent.chiefComplaint
          if (cc.primary_complaint) updated.chiefComplaint = cc.primary_complaint
          if (cc.pain_scale) updated.painIntensity = cc.pain_scale
          if (cc.patient_description) updated.painLocation = cc.patient_description
        }

        // HOPI Distribution
        if (processedContent.hopi) {
          const hopi = processedContent.hopi
          if (hopi.pain_characteristics?.quality) updated.painCharacter = hopi.pain_characteristics.quality
          if (hopi.pain_characteristics?.duration) updated.painDuration = hopi.pain_characteristics.duration
          if (hopi.aggravating_factors) updated.painTriggers = hopi.aggravating_factors
          if (hopi.relieving_factors) updated.painRelief = hopi.relieving_factors
        }

        // Medical History Distribution
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
        }

        // Clinical Examination Distribution
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

        // Investigations Distribution
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

        // Diagnosis Distribution
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

        // Treatment Plan Distribution
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

      // Show success notification
      console.log(`🎉 Voice content successfully distributed to ${Object.keys(processedContent).length} sections`)

    } catch (error) {
      console.error('❌ Error distributing content to tabs:', error)
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
          updated.painTriggers = tabData.triggers || []
          break

        case 'hopi':
          updated.painCharacter = tabData.pain_characteristics?.quality || ''
          updated.painDuration = tabData.pain_characteristics?.duration || updated.painDuration
          updated.painIntensity = tabData.pain_characteristics?.intensity || updated.painIntensity
          updated.painTriggers = tabData.aggravating_factors || []
          updated.painRelief = tabData.relieving_factors || []
          break

        case 'medical-history':
          updated.medicalHistory = tabData.current_conditions || []
          updated.currentMedications = tabData.current_medications || []
          updated.allergies = tabData.allergies || []
          break

        case 'personal-history':
          updated.previousDentalTreatments = tabData.oral_hygiene ? [
            `Brushing: ${tabData.oral_hygiene.brushing_frequency || 'Not specified'}`,
            `Flossing: ${tabData.oral_hygiene.flossing_frequency || 'Not specified'}`,
            `Last visit: ${tabData.oral_hygiene.last_dental_visit || 'Not specified'}`
          ] : []
          break

        case 'clinical-examination':
          updated.extraoralFindings = Object.values(tabData.extraoral_findings || {}).join('; ')
          updated.intraoralFindings = Object.values(tabData.intraoral_findings || {}).join('; ')
          updated.periodontalStatus = tabData.intraoral_findings?.periodontal_status || ''
          break

        case 'investigations':
          updated.radiographicFindings = tabData.radiographic?.findings || ''
          updated.vitalityTests = tabData.clinical_tests?.vitality_test || ''
          updated.percussionTests = tabData.clinical_tests?.percussion_test || ''
          updated.palpationFindings = tabData.clinical_tests?.palpation_test || ''
          break

        case 'clinical-diagnosis':
          updated.provisionalDiagnosis = tabData.provisional_diagnoses || []
          updated.differentialDiagnosis = tabData.differential_diagnoses || []
          updated.finalDiagnosis = tabData.final_diagnoses || []
          break

        case 'treatment-plan':
          updated.treatmentPlan = tabData.treatment_phases || []
          updated.prognosis = tabData.overall_prognosis || ''
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

  const loadPreviousConsultationData = async (patientId: string) => {
    setIsLoadingConsultation(true)
    setLoadingError(null)

    try {
      console.log('🔍 Loading previous consultation data for patient:', patientId)

      const result = await loadPatientConsultationAction(patientId)

      if (result.error) {
        console.error('❌ Error loading consultation data:', result.error)
        setLoadingError(`Failed to load consultation data: ${result.error}`)
        return
      }

      if (result.data) {
        console.log('✅ Found previous consultation data, loading...', {
          consultationId: result.data.consultation.id,
          toothCount: Object.keys(result.data.toothData).length
        })

        // Load the consultation data into state
        setConsultationData(result.data.consultationData)
        setToothData(result.data.toothData)

        // Show success message with better UX
        const toothCount = Object.keys(result.data.toothData).length
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

  const handlePatientSelect = async (patient: Patient) => {
    setSelectedPatient(patient)
    setConsultationData(prev => ({ ...prev, patientId: patient.id }))
    setSearchTerm("")
    setPatients([])
    onPatientSelect?.(patient)

    // Load previous consultation data
    await loadPreviousConsultationData(patient.id)
    
    // Auto-create a draft consultation to enable voice recording
    if (!savedConsultationId) {
      console.log('🎤 [AUTO-DRAFT] Creating draft consultation for voice recording...')
      try {
        const result = await saveConsultationSectionAction({
          patientId: patient.id,
          consultationId: undefined,
          sectionId: 'initial',
          sectionData: { patientId: patient.id, created_at: new Date().toISOString() }
        })
        if (result.success && result.consultationId) {
          setSavedConsultationId(result.consultationId)
          console.log('✅ [AUTO-DRAFT] Draft consultation created:', result.consultationId)
        }
      } catch (error) {
        console.error('❌ [AUTO-DRAFT] Failed to create draft consultation:', error)
      }
    }
  }

  const handleSaveConsultation = async (status: 'draft' | 'completed' = 'draft') => {
    if (!selectedPatient) return

    setIsSaving(true)
    try {
      console.log('💾 [SAVE] Starting consultation save...', {
        status,
        patientId: selectedPatient.id,
        toothDataCount: Object.keys(toothData).length,
        consultationData: consultationData
      })

      const result = await saveCompleteConsultationAction({
        patientId: selectedPatient.id,
        // dentistId will be obtained from authentication in the action
        consultationData: consultationData,
        toothData: toothData,
        status: status
      })

      if (result.error) {
        console.error('❌ [SAVE] Error saving consultation:', result.error)

        // Provide specific error guidance based on common issues
        let errorMessage = `Failed to save consultation: ${result.error}`
        if (result.error.includes('Authentication')) {
          errorMessage = 'Please log in again and try saving the consultation.'
        } else if (result.error.includes('permission')) {
          errorMessage = 'Permission denied. Please contact your administrator.'
        } else if (result.error.includes('network')) {
          errorMessage = 'Network error. Please check your connection and try again.'
        }

        alert(errorMessage)
      } else {
        console.log('✅ [SAVE] Consultation saved successfully:', result.data)
        const toothCount = result.data.toothCount || 0
        const statusText = status === 'draft' ? 'draft saved' : 'completed'

        // Capture consultation ID and set completion state
        if (result.data.consultation?.id) {
          setSavedConsultationId(result.data.consultation.id)
        }

        if (status === 'completed') {
          setIsConsultationCompleted(true)
        }

        if (toothCount > 0) {
          alert(`Consultation ${statusText} successfully! ${toothCount} teeth with treatment data recorded.`)
        } else {
          alert(`Consultation ${statusText} successfully! No tooth data recorded.`)
        }

        if (status === 'completed') {
          // Don't reset form immediately - show appointment request option first
          // Form will be reset after appointment request or user navigates away
          console.log('🎯 [CONSULTATION] Completed - showing appointment request option')
        } else {
          // Reset form for draft saves
          setSelectedPatient(null)
          setToothData({})
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
        }
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

  // Tab navigation functions
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

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!activeSection) return

      // Only handle arrow keys if no input is focused
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

  // The function updateConsultationFromTabData is already defined above at line 568
  // This duplicate function definition has been removed

  // Individual tab save functionality
  const handleTabSave = async (sectionId: string, tabData: any) => {
    if (!selectedPatient) return

    try {
      console.log(`💾 Saving ${sectionId} data:`, tabData)

      // Update consultation data based on the tab data
      updateConsultationFromTabData(sectionId, tabData)

      // Auto-save to draft
      const result = await saveCompleteConsultationAction({
        patientId: selectedPatient.id,
        consultationData: consultationData,
        toothData: toothData,
        status: 'draft'
      })

      if (result.error) {
        throw new Error(result.error)
      }

      console.log(`✅ ${sectionId} saved successfully`)
      alert(`${sectionId} section saved successfully!`)
    } catch (error) {
      console.error(`❌ Error saving ${sectionId}:`, error)
      alert(`Failed to save ${sectionId}: ${error.message}`)
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

  // Main consultation interface with box grid layout
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
                // Reset form after successful appointment request
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
                }, 2000) // Wait for success message to show
              }}
            />
          )}
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
                <p>Age: {(() => { const age = getPatientAge(selectedPatient.date_of_birth); return age !== null ? `${age} years` : '—' })()}</p>
                <p>DOB: {formatDOB(selectedPatient.date_of_birth) ?? '—'}</p>
              </div>

              {/* Loading and Error States */}
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

      {/* Consultation Progress Analytics */}
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
                {/* Overall Progress Bar */}
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

                {/* Section Status Breakdown */}
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

                {/* Quick Actions */}
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

      {/* FDI Interactive Dental Chart */}
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
            consultationId={undefined} // undefined for new consultation to load latest diagnoses
            multiSelectMode={true}
            onToothStatusChange={(toothNumber, status, data) => {
              console.log('🦷 Right-click status change:', { toothNumber, status, data })
              // Update the local toothData state with the new data
              setToothData(prev => ({
                ...prev,
                [toothNumber]: data
              }))
            }}
          />

          {/* Real-time Numbered Data Representation */}
          <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-teal-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-blue-700">🦷 Real-time Dental Chart Data</h3>
              <Badge className="bg-blue-100 text-blue-800 text-xs">
                {Object.keys(toothData).length} Teeth with Data
              </Badge>
            </div>

            {/* FDI Numbering Grid - Real-time Updates */}
            <div className="space-y-4">
              {/* Upper Jaw */}
              <div>
                <Label className="text-xs font-medium text-gray-600 mb-2 block">Upper Jaw (Maxilla)</Label>
                <div className="grid grid-cols-8 gap-1">
                  {[18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28].map(toothNum => {
                    const toothInfo = toothData[toothNum.toString()]
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

              {/* Lower Jaw */}
              <div>
                <Label className="text-xs font-medium text-gray-600 mb-2 block">Lower Jaw (Mandible)</Label>
                <div className="grid grid-cols-8 gap-1">
                  {[48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38].map(toothNum => {
                    const toothInfo = toothData[toothNum.toString()]
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

              {/* Legend */}
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

      {/* Global Voice Recorder */}
      <GlobalVoiceRecorder
        consultationId={savedConsultationId || ''}
        onContentProcessed={(content) => {
          console.log('🎤 Processed voice content:', content)
          distributeContentToTabs(content)
        }}
        onToothDiagnosisSaved={async () => {
          console.log('🦷 [REFRESH] Reloading tooth data after voice diagnosis...')
          // Force re-render to update FDI chart
          if (selectedPatient?.id) {
            await loadPreviousConsultationData(selectedPatient.id)
            console.log('✅ [REFRESH] Tooth data reloaded')
          }
        }}
        isEnabled={!!savedConsultationId}
      />

      {/* Consultation Sections Grid */}
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
                    {/* Validation Indicator */}
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
                  {/* Validation Status */}
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

      {/* Section Detail Modal */}
      <Dialog open={!!activeSection} onOpenChange={() => setActiveSection(null)}>
        <DialogContent className="max-w-4xl h-[90vh] overflow-hidden">
          <DialogHeader className="space-y-4">
            {/* Tab Navigation Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Previous Tab Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={navigateToPreviousTab}
                  disabled={!getCurrentTabInfo().hasPrevious}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                {/* Tab Progress Indicator */}
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>{getCurrentTabInfo().current} of {getCurrentTabInfo().total}</span>
                  <div className="w-20 bg-gray-200 rounded-full h-1">
                    <div
                      className="bg-teal-600 h-1 rounded-full transition-all duration-300"
                      style={{ width: `${(getCurrentTabInfo().current / getCurrentTabInfo().total) * 100}%` }}
                    ></div>
                  </div>
                </div>

                {/* Next Tab Button */}
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

              {/* Close Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveSection(null)}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Tab Title and Actions */}
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getConsultationSections().find(s => s.id === activeSection)?.icon}
                <span>{getConsultationSections().find(s => s.id === activeSection)?.title}</span>
                <div className={`text-xs px-2 py-1 rounded ${getStatusColor(getCurrentTabInfo().section?.status)}`}>
                  {getCurrentTabInfo().section?.status === 'empty' && 'Not Started'}
                  {getCurrentTabInfo().section?.status === 'partial' && 'In Progress'}
                  {getCurrentTabInfo().section?.status === 'complete' && 'Completed'}
                </div>
              </div>

              {/* Voice Recording Button */}
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

                // Create default data structures for each tab
                const getDefaultData = () => {
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
                        onset_details: {
                          when_started: '',
                          how_started: '',
                          precipitating_factors: []
                        },
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
                        current_conditions: consultationData.medicalHistory || [],
                        past_conditions: [],
                        current_medications: consultationData.currentMedications || [],
                        allergies: consultationData.allergies || [],
                        family_history: [],
                        surgical_history: [],
                        hospitalization_history: [],
                        immunization_status: {}
                      }
                    case 'personal-history':
                      return {
                        smoking: { status: 'never', details: '' },
                        alcohol: { status: 'never', details: '' },
                        tobacco: { status: 'never', details: '' },
                        diet: { type: '', details: '' },
                        exercise: { frequency: '', details: '' },
                        sleep: { hours: 0, quality: '' },
                        stress: { level: '', details: '' },
                        oral_hygiene: {
                          brushing_frequency: '',
                          flossing_frequency: '',
                          mouthwash_use: false,
                          last_dental_visit: ''
                        },
                        occupational_history: '',
                        travel_history: ''
                      }
                    case 'clinical-examination':
                      return {
                        vital_signs: {
                          blood_pressure: '',
                          pulse_rate: '',
                          temperature: '',
                          respiratory_rate: '',
                          oxygen_saturation: ''
                        },
                        extraoral_findings: {
                          general_appearance: '',
                          facial_symmetry: '',
                          facial_profile: '',
                          lip_competency: '',
                          facial_height: '',
                          lymph_nodes: [],
                          tmj_examination: '',
                          swellings: [],
                          skin_condition: '',
                          other_findings: ''
                        },
                        intraoral_findings: {
                          oral_hygiene: '',
                          gingival_condition: '',
                          periodontal_status: consultationData.periodontalStatus || '',
                          tongue_examination: '',
                          palate_examination: '',
                          floor_of_mouth: '',
                          buccal_mucosa: '',
                          lips: '',
                          teeth_present: [],
                          teeth_missing: [],
                          restorations: [],
                          caries: [],
                          mobility: [],
                          occlusion: '',
                          other_findings: ''
                        },
                        general_examination: '',
                        examination_date: '',
                        examination_time: '',
                        examiner_notes: ''
                      }
                    case 'investigations':
                      return {
                        radiographic: {
                          type: [],
                          findings: consultationData.radiographicFindings || '',
                          date_taken: ''
                        },
                        clinical_tests: {
                          vitality_test: consultationData.vitalityTests || '',
                          percussion_test: consultationData.percussionTests || '',
                          palpation_test: consultationData.palpationFindings || '',
                          mobility_test: '',
                          thermal_test: ''
                        },
                        laboratory_tests: {
                          blood_tests: [],
                          other_tests: []
                        }
                      }
                    case 'clinical-diagnosis':
                      return {
                        provisional_diagnoses: [],
                        differential_diagnoses: [],
                        final_diagnoses: [],
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
                        treatment_phases: [],
                        tooth_specific_treatments: {},
                        overall_prognosis: '',
                        treatment_goals: [],
                        patient_consent_obtained: false,
                        insurance_verification: false,
                        estimated_total_cost: 0,
                        estimated_total_duration: '',
                        contraindications: [],
                        patient_preferences: '',
                        follow_up_plan: ''
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
                      return {
                        appointments: [],
                        post_care_instructions: [],
                        tooth_specific_follow_ups: {},
                        general_follow_up_notes: '',
                        next_visit_required: false,
                        emergency_contact_provided: false,
                        patient_education_completed: false,
                        recall_period: ''
                      }
                    case 'diagnosis-overview':
                      // Pass the live toothData directly to DiagnosisOverviewTab
                      return toothData
                    case 'treatment-overview':
                      // Pass the live toothData directly to TreatmentOverviewTab
                      return toothData
                    default:
                      return {}
                  }
                }

                // Handle special props for overview tabs
                const isOverviewTab = activeSection === 'diagnosis-overview' || activeSection === 'treatment-overview'
                const overviewProps = isOverviewTab ? {
                  consultationData: {
                    clinicianName: 'Dr. ' + (selectedPatient?.first_name || 'Dentist'),
                    patientName: `${selectedPatient?.first_name || ''} ${selectedPatient?.last_name || ''}`.trim(),
                    consultationDate: new Date().toISOString().split('T')[0]
                  }
                } : {}

                const defaultData = getDefaultData()
                console.log(`🔍 [PARENT] Rendering ${section.title} with data:`, defaultData)
                console.log(`🔍 [PARENT] isReadOnly:`, false)
                console.log(`🔍 [PARENT] onChange function exists:`, !!((data: any) => {
                  console.log(`📝 ${section.title} data updated:`, data)
                  updateConsultationFromTabData(activeSection, data)
                }))

                return (
                  <div
                    key={activeSection}
                    className="animate-in fade-in-50 slide-in-from-bottom-2 duration-300"
                  >
                    <TabComponent
                      data={defaultData}
                      onChange={(data: any) => {
                        console.log(`🔄 [PARENT] ${section.title} onChange triggered with:`, data)
                        // Update consultation data state based on the tab
                        updateConsultationFromTabData(activeSection, data)
                      }}
                      isReadOnly={false}
                      onSave={(data: any) => {
                        console.log(`💾 [PARENT] ${section.title} onSave triggered with:`, data)
                        return handleTabSave(activeSection, data)
                      }}
                      {...overviewProps}
                    />
                  </div>
                )
              }

              // Fallback for sections without components
              return (
                <div className="space-y-6">
                  <div className="text-center py-8">
                    <h3 className="text-lg font-semibold mb-2">{section?.title}</h3>
                    <p className="text-gray-500">This section is under development.</p>
                    <p className="text-sm text-gray-400 mt-2">Section ID: {activeSection}</p>
                  </div>

                  {/* Basic form for sections without specific components */}
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor={`${activeSection}-notes`}>Notes</Label>
                      <Textarea
                        id={`${activeSection}-notes`}
                        placeholder={`Enter ${section?.title.toLowerCase()} details...`}
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

      {/* Tooth-Specific Interface Modal */}
      {showToothInterface && selectedTooth && (
        <SimpleToothInterface
          toothNumber={selectedTooth}
          onClose={() => {
            setShowToothInterface(false)
            setSelectedTooth(null)
          }}
          onSave={(data) => {
            console.log('💾 Saving tooth data for tooth', selectedTooth, ':', data)

            // Handle both single tooth and multi-select saves
            if (typeof data === 'object' && !Array.isArray(data)) {
              // Check if this is multi-tooth data (object with tooth numbers as keys)
              const isMultiToothData = Object.keys(data).some(key => /^\d+$/.test(key))

              if (isMultiToothData) {
                // Multi-tooth save: merge all tooth data
                console.log('🔄 Multi-tooth save detected. Updating multiple teeth:', Object.keys(data))
                setToothData(prev => ({
                  ...prev,
                  ...data
                }))
              } else {
                // Single tooth save
                setToothData(prev => ({
                  ...prev,
                  [selectedTooth]: data
                }))
              }
            }

            setShowToothInterface(false)
          }}
        />
      )}
    </div>
  )
}