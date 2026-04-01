'use client'

/**
 * Enhanced New Consultation V5
 *
 * Mode-based consultation wrapper:
 * - new_consultation: Renders V4 UNCHANGED (zero behavior change)
 * - treatment_visit: Streamlined treatment recording with episode context
 * - follow_up: Healing assessment and outcome evaluation
 * - emergency: Fast-track entry
 *
 * FALLBACK: If V5 encounters any error, it renders V4 directly.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Stethoscope, ChevronDown, ChevronUp, Save, CheckCircle,
  AlertTriangle, Wrench, HeartPulse, Siren, Sparkles,
  FileText, Download, Send, Loader2,
} from 'lucide-react'

// V4 — the existing consultation component (rendered unchanged for new_consultation)
import { EnhancedNewConsultationV4 } from './enhanced-new-consultation-v4'

// Mode system
import { ConsultationModeSelector } from '@/components/consultation/ConsultationModeSelector'
import type { ConsultationMode } from '@/lib/types/consultation-modes'
import { CONSULTATION_MODES, detectConsultationMode } from '@/lib/types/consultation-modes'

// Mode-specific tabs
import { TreatmentProgressTab } from '@/components/consultation/tabs/TreatmentProgressTab'
import { ProceduresDoneTab } from '@/components/consultation/tabs/ProceduresDoneTab'
import { MaterialsUsedTab } from '@/components/consultation/tabs/MaterialsUsedTab'
import { ClinicalNotesTab } from '@/components/consultation/tabs/ClinicalNotesTab'
import { NextVisitPlanTab } from '@/components/consultation/tabs/NextVisitPlanTab'
import { HealingStatusTab } from '@/components/consultation/tabs/HealingStatusTab'
import { OutcomeEvaluationTab } from '@/components/consultation/tabs/OutcomeEvaluationTab'
import { QuickExamTab } from '@/components/consultation/tabs/QuickExamTab'
import { ImmediateTreatmentTab } from '@/components/consultation/tabs/ImmediateTreatmentTab'

// Server actions
import { getActiveEpisodesForPatientAction, getEpisodeWithVisitsAction } from '@/lib/actions/treatment-episodes'
import { finalizeConsultationFromDraftAction } from '@/lib/actions/consultation'
import { runTrackingPipelineAction } from '@/lib/actions/tracking-pipeline'
import { updateEpisodeVisitAction, confirmVisitAssessmentAction } from '@/lib/actions/episode-visits'
import { InteractiveDentalChart } from './interactive-dental-chart'
import { generateConsultationReportAction, saveReportToProfileAction } from '@/lib/actions/consultation-report'
import { TrackingAssessmentPanel } from '@/components/consultation/TrackingAssessmentPanel'
import type { TrackingPipelineOutput } from '@/lib/services/tracking-pipeline'

// ─── Props ────────────────────────────────────────
interface EnhancedNewConsultationV5Props {
  selectedPatientId?: string
  appointmentId?: string
  dentistId?: string
  appointmentType?: string  // Used for auto-detection
  episodeId?: string        // Pre-select an episode
  onPatientSelect?: (patient: any) => void
  /** Session 18: Mobile-optimized layout */
  isMobileView?: boolean
}

// ─── Visit Data State ─────────────────────────────
interface VisitFormData {
  procedures: string[]
  materials: Record<string, string>
  clinicalNotes: string
  complications: string
  nextVisitPlan: string
  suggestedNextDate: string
  healingStatus: '' | 'healing_normal' | 'delayed_healing' | 'complication' | 'failure' | 'new_issue'
  healingNotes: string
  outcome: '' | 'success' | 'partial_success' | 'failure'
  outcomeNotes: string
  quickExam: {
    vitalSigns?: string
    extraoralFindings?: string
    intraoralFindings?: string
    painScale?: number
    swelling?: boolean
    bleeding?: boolean
    mobility?: boolean
  }
  emergencyTreatment: {
    treatmentPerformed?: string
    materialsUsed?: string
    postOpInstructions?: string
    referralNeeded?: boolean
    referralNotes?: string
    followUpRequired?: boolean
    followUpDays?: number
  }
  prescriptions: any[]
}

const initialVisitData: VisitFormData = {
  procedures: [],
  materials: {},
  clinicalNotes: '',
  complications: '',
  nextVisitPlan: '',
  suggestedNextDate: '',
  healingStatus: '',
  healingNotes: '',
  outcome: '',
  outcomeNotes: '',
  quickExam: {},
  emergencyTreatment: {},
  prescriptions: [],
}

// ─── Component ────────────────────────────────────
export function EnhancedNewConsultationV5(props: EnhancedNewConsultationV5Props) {
  const [mode, setMode] = useState<ConsultationMode>('new_consultation')
  const [v5Error, setV5Error] = useState(false)
  const [visitData, setVisitData] = useState<VisitFormData>(initialVisitData)
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(props.episodeId || null)
  const [episode, setEpisode] = useState<any>(null)
  const [episodeVisits, setEpisodeVisits] = useState<any[]>([])
  const [activeEpisodes, setActiveEpisodes] = useState<any[]>([])
  const [showFdiChart, setShowFdiChart] = useState(false)
  const [toothData, setToothData] = useState<Record<string, any>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [savedConsultationId, setSavedConsultationId] = useState<string | null>(null)
  const [activeTabDialog, setActiveTabDialog] = useState<string | null>(null)

  // Phase 4: Report generation state
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const [reportGenerated, setReportGenerated] = useState(false)

  // Tracking pipeline state
  const [trackingAssessment, setTrackingAssessment] = useState<TrackingPipelineOutput | null>(null)
  const [isTrackingLoading, setIsTrackingLoading] = useState(false)
  const [isConfirmingAssessment, setIsConfirmingAssessment] = useState(false)
  const [savedVisitId, setSavedVisitId] = useState<string | null>(null)

  // Session 12: Voice command state (populated from sessionStorage by Master AI)
  const [voicePatientId, setVoicePatientId] = useState<string | null>(null)
  const [voiceAppointmentId, setVoiceAppointmentId] = useState<string | null>(null)
  const [voiceMode, setVoiceMode] = useState<string | null>(null)

  // Session 10 Phase 3: Load linked diagnosis context from appointment
  const [appointmentContext, setAppointmentContext] = useState<{
    linkedDiagnosis?: string
    linkedTreatmentPlan?: string
    linkedToothNumbers?: string[]
    linkedEpisodeId?: string
  } | null>(null)

  // Session 12: Consume voice command from sessionStorage (set by Master AI)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = sessionStorage.getItem('endoflow_consultation_command')
    if (!raw) return
    try {
      const cmd = JSON.parse(raw)
      sessionStorage.removeItem('endoflow_consultation_command') // consume once
      if (cmd.patientId) {
        setVoicePatientId(cmd.patientId)
        console.log(`🎤 [V5] Voice command consumed: patient=${cmd.patientName}, mode=${cmd.consultationMode}`)
      }
      if (cmd.appointmentId) setVoiceAppointmentId(cmd.appointmentId)
      if (cmd.consultationMode) setVoiceMode(cmd.consultationMode)
    } catch (e) {
      console.warn('[V5] Failed to parse endoflow_consultation_command:', e)
    }
  }, [])

  useEffect(() => {
    if (props.appointmentId) {
      // Fetch appointment to get linked diagnosis chain
      import('@/lib/supabase/client').then(({ createClient }) => {
        const supabase = createClient()
        supabase
          .schema('api' as any)
          .from('appointments')
          .select('linked_episode_id, linked_tooth_numbers, linked_diagnosis, linked_treatment_plan, appointment_type')
          .eq('id', props.appointmentId)
          .single()
          .then(({ data }) => {
            if (data) {
              const ctx: any = {}
              if (data.linked_diagnosis) ctx.linkedDiagnosis = data.linked_diagnosis
              if (data.linked_treatment_plan) ctx.linkedTreatmentPlan = data.linked_treatment_plan
              if (data.linked_episode_id) ctx.linkedEpisodeId = data.linked_episode_id
              if (data.linked_tooth_numbers) {
                try { ctx.linkedToothNumbers = JSON.parse(data.linked_tooth_numbers) } catch {}
              }
              if (Object.keys(ctx).length > 0) {
                setAppointmentContext(ctx)
                console.log('📋 [V5] Loaded appointment diagnosis context:', ctx)
                // Auto-select the linked episode if not already set
                if (ctx.linkedEpisodeId && !props.episodeId) {
                  setSelectedEpisodeId(ctx.linkedEpisodeId)
                }
              }
            }
          })
      })
    }
  }, [props.appointmentId])

  // Auto-detect mode on mount (voice command overrides props)
  useEffect(() => {
    if (voiceMode) {
      setMode(voiceMode as ConsultationMode)
    } else if (props.appointmentType || props.episodeId) {
      const detected = detectConsultationMode({
        appointmentType: props.appointmentType,
        hasActiveEpisode: !!props.episodeId,
      })
      setMode(detected)
    }
  }, [props.appointmentType, props.episodeId, voiceMode])

  // Load active episodes when patient is known (props or voice command)
  useEffect(() => {
    const effectivePatientId = props.selectedPatientId || voicePatientId
    if (effectivePatientId && mode !== 'new_consultation') {
      loadActiveEpisodes(effectivePatientId)
    }
  }, [props.selectedPatientId, voicePatientId, mode])

  // Load selected episode details
  useEffect(() => {
    if (selectedEpisodeId) {
      loadEpisodeDetails(selectedEpisodeId)
    }
  }, [selectedEpisodeId])

  const loadActiveEpisodes = async (patientId: string) => {
    try {
      const result = await getActiveEpisodesForPatientAction(patientId)
      if (result.success && result.episodes) {
        setActiveEpisodes(result.episodes)
        // Auto-select if only one episode or if episodeId prop provided
        if (result.episodes.length === 1 && !selectedEpisodeId) {
          setSelectedEpisodeId(result.episodes[0].id)
        }
      }
    } catch (e) {
      console.warn('Failed to load active episodes:', e)
    }
  }

  const loadEpisodeDetails = async (epId: string) => {
    try {
      const result = await getEpisodeWithVisitsAction(epId)
      if (result.success) {
        setEpisode(result.episode)
        setEpisodeVisits(result.visits || [])
      }
    } catch (e) {
      console.warn('Failed to load episode details:', e)
    }
  }

  // Save handler for treatment/follow-up/emergency modes
  const handleSave = async (status: 'draft' | 'completed') => {
    if (!props.selectedPatientId || !props.dentistId) return

    setIsSaving(true)
    try {
      const consultationData: any = {
        chiefComplaint: mode === 'emergency'
          ? visitData.quickExam.intraoralFindings || 'Emergency visit'
          : `${mode.replace('_', ' ')} visit`,
        consultationMode: mode,
        episodeId: selectedEpisodeId,
        prescriptions: visitData.prescriptions,
        additionalNotes: visitData.clinicalNotes,
        // Pack visit-specific data into consultation fields
        treatmentPlan: visitData.procedures.length > 0
          ? JSON.stringify(visitData.procedures)
          : undefined,
      }

      const result = await finalizeConsultationFromDraftAction({
        patientId: props.selectedPatientId,
        dentistId: props.dentistId,
        consultationData,
        toothData,
        status,
        appointmentId: props.appointmentId,
      })

      if (result.success) {
        setIsSaved(true)
        if (result.data?.id) setSavedConsultationId(result.data.id)
        console.log('✅ [V5] Consultation saved:', result.data?.id)
      }
    } catch (e) {
      console.error('❌ [V5] Save failed:', e)
    } finally {
      setIsSaving(false)
    }
  }

  // Phase 4: Listen for voice command to generate report
  useEffect(() => {
    const handler = () => {
      if (savedConsultationId) {
        handleGenerateReport({ saveToProfile: true })
      }
    }
    window.addEventListener('endoflow:generate_report', handler)
    return () => window.removeEventListener('endoflow:generate_report', handler)
  }, [savedConsultationId])

  // Phase 4: Generate and download consultation report
  const handleGenerateReport = async (options?: { saveToProfile?: boolean; includeTranscript?: boolean }) => {
    if (!savedConsultationId) return
    setIsGeneratingReport(true)
    try {
      const result = await generateConsultationReportAction({
        consultationId: savedConsultationId,
        includeTranscript: options?.includeTranscript ?? false,
      })

      if (result.success && result.pdfBase64 && result.fileName) {
        // Trigger browser download
        const link = document.createElement('a')
        link.href = `data:application/pdf;base64,${result.pdfBase64}`
        link.download = result.fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        // Save to patient profile if requested (Session 12: fallback to V4 patient)
        const reportPatientId = props.selectedPatientId || sessionStorage.getItem('endoflow_v4_patient_id')
        if (options?.saveToProfile && reportPatientId) {
          await saveReportToProfileAction({
            consultationId: savedConsultationId,
            patientId: reportPatientId,
            pdfBase64: result.pdfBase64,
            fileName: result.fileName,
          })
        }

        setReportGenerated(true)
        console.log('✅ [V5] Report generated:', result.fileName)
      } else {
        console.error('❌ [V5] Report generation failed:', result.error)
      }
    } catch (e) {
      console.error('❌ [V5] Report error:', e)
    } finally {
      setIsGeneratingReport(false)
    }
  }

  // Run tracking pipeline for treatment/follow-up modes
  const runTracking = async () => {
    if (!selectedEpisodeId || mode === 'new_consultation' || mode === 'emergency') return

    setIsTrackingLoading(true)
    setTrackingAssessment(null)

    try {
      const result = await runTrackingPipelineAction({
        episodeId: selectedEpisodeId,
        currentTranscript: visitData.clinicalNotes || undefined,
        currentFindings: visitData.clinicalNotes || undefined,
        currentProcedures: visitData.procedures.length > 0 ? visitData.procedures : undefined,
        currentComplications: visitData.complications || undefined,
        mode: mode as 'treatment_visit' | 'follow_up',
      })

      if (result.success && result.assessment) {
        setTrackingAssessment(result.assessment)
      }
    } catch (e) {
      console.warn('⚠️ [V5] Tracking pipeline failed:', e)
    } finally {
      setIsTrackingLoading(false)
    }
  }

  // Confirm AI assessment (human-in-the-loop)
  const handleConfirmAssessment = async () => {
    if (!trackingAssessment || !savedVisitId) {
      // If no visit saved yet, just mark as confirmed conceptually
      setTrackingAssessment(null)
      return
    }

    setIsConfirmingAssessment(true)
    try {
      // Store AI assessment on the visit
      await updateEpisodeVisitAction(savedVisitId, {
        aiProgressAssessment: trackingAssessment as any,
      })
      // Mark as dentist-confirmed
      await confirmVisitAssessmentAction(savedVisitId)
      console.log('✅ [V5] Assessment confirmed for visit:', savedVisitId)
    } catch (e) {
      console.warn('⚠️ [V5] Failed to confirm assessment:', e)
    } finally {
      setIsConfirmingAssessment(false)
      setTrackingAssessment(null)
    }
  }

  // Dismiss AI assessment
  const handleDismissAssessment = () => {
    setTrackingAssessment(null)
  }

  // ─── FALLBACK: If V5 has an error, render V4 directly ────
  if (v5Error) {
    console.warn('⚠️ [V5] Falling back to V4 due to error')
    return (
      <EnhancedNewConsultationV4
        selectedPatientId={props.selectedPatientId || voicePatientId || undefined}
        appointmentId={props.appointmentId || voiceAppointmentId || undefined}
        dentistId={props.dentistId}
        onPatientSelect={props.onPatientSelect}
        isMobileView={props.isMobileView}
      />
    )
  }

  // ─── NEW CONSULTATION MODE: Render V4 unchanged ────
  if (mode === 'new_consultation') {
    return (
      <div>
        {/* Mode selector bar */}
        <div className="mb-4 p-3 rounded-xl bg-card border border-border">
          <div className="flex items-center justify-between">
            <ConsultationModeSelector
              activeMode={mode}
              onModeChange={setMode}
            />
          </div>
        </div>

        {/* V4 rendered with consultation save callback for Report button */}
        <EnhancedNewConsultationV4
          selectedPatientId={props.selectedPatientId || voicePatientId || undefined}
          appointmentId={props.appointmentId || voiceAppointmentId || undefined}
          dentistId={props.dentistId}
          onPatientSelect={props.onPatientSelect}
          isMobileView={props.isMobileView}
          onConsultationSaved={(consultationId, patientId) => {
            setSavedConsultationId(consultationId)
            setIsSaved(true)
            // Store patientId in sessionStorage for report generation
            sessionStorage.setItem('endoflow_v4_patient_id', patientId)
            console.log('📋 [V5] V4 consultation saved — report button now available', { consultationId, patientId })
          }}
        />

        {/* Session 12: Generate Report button — appears after V4 saves consultation */}
        {isSaved && savedConsultationId && (
          <div className="mt-4 p-3 rounded-xl bg-card border border-border">
            <Button
              onClick={() => {
                const patientId = props.selectedPatientId || sessionStorage.getItem('endoflow_v4_patient_id')
                handleGenerateReport({ saveToProfile: !!patientId })
              }}
              disabled={isGeneratingReport}
              variant="outline"
              size="sm"
              className={reportGenerated ? "border-green-500 text-green-700" : ""}
            >
              {isGeneratingReport ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Report...
                </>
              ) : reportGenerated ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Report Saved ✓
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Report PDF
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    )
  }

  // ─── TREATMENT / FOLLOW-UP / EMERGENCY MODES ────
  const modeConfig = CONSULTATION_MODES[mode]

  // Define which tabs to show based on mode
  const getModeTabs = (): Array<{ id: string; label: string; icon: typeof Stethoscope }> => {
    switch (mode) {
      case 'treatment_visit':
        return [
          { id: 'treatment-progress', label: 'Episode Progress', icon: CheckCircle },
          { id: 'procedures-done', label: 'Procedures Done', icon: Wrench },
          { id: 'materials-used', label: 'Materials Used', icon: Wrench },
          { id: 'clinical-notes', label: 'Clinical Notes', icon: Stethoscope },
          { id: 'next-visit-plan', label: 'Next Visit Plan', icon: Stethoscope },
        ]
      case 'follow_up':
        return [
          { id: 'treatment-progress', label: 'Episode Progress', icon: CheckCircle },
          { id: 'healing-status', label: 'Healing Status', icon: HeartPulse },
          { id: 'outcome-evaluation', label: 'Outcome', icon: CheckCircle },
          { id: 'clinical-notes', label: 'Clinical Notes', icon: Stethoscope },
        ]
      case 'emergency':
        return [
          { id: 'quick-exam', label: 'Quick Examination', icon: AlertTriangle },
          { id: 'immediate-treatment', label: 'Treatment', icon: Siren },
        ]
      default:
        return []
    }
  }

  const modeTabs = getModeTabs()

  // Render tab content based on tab ID
  const renderTabContent = (tabId: string) => {
    switch (tabId) {
      case 'treatment-progress':
        return <TreatmentProgressTab episode={episode} visits={episodeVisits} />
      case 'procedures-done':
        return (
          <ProceduresDoneTab
            procedures={visitData.procedures}
            onChange={(procedures) => setVisitData(prev => ({ ...prev, procedures }))}
          />
        )
      case 'materials-used':
        return (
          <MaterialsUsedTab
            materials={visitData.materials}
            onChange={(materials) => setVisitData(prev => ({ ...prev, materials }))}
          />
        )
      case 'clinical-notes':
        return (
          <ClinicalNotesTab
            notes={visitData.clinicalNotes}
            complications={visitData.complications}
            onChange={({ notes, complications }) =>
              setVisitData(prev => ({ ...prev, clinicalNotes: notes, complications }))
            }
          />
        )
      case 'next-visit-plan':
        return (
          <NextVisitPlanTab
            plan={visitData.nextVisitPlan}
            suggestedDate={visitData.suggestedNextDate}
            onChange={({ plan, suggestedDate }) =>
              setVisitData(prev => ({ ...prev, nextVisitPlan: plan, suggestedNextDate: suggestedDate }))
            }
          />
        )
      case 'healing-status':
        return (
          <HealingStatusTab
            healingStatus={visitData.healingStatus as any}
            healingNotes={visitData.healingNotes}
            onChange={({ healingStatus, healingNotes }) =>
              setVisitData(prev => ({ ...prev, healingStatus: healingStatus as any, healingNotes }))
            }
          />
        )
      case 'outcome-evaluation':
        return (
          <OutcomeEvaluationTab
            outcome={visitData.outcome as any}
            outcomeNotes={visitData.outcomeNotes}
            onChange={({ outcome, outcomeNotes }) =>
              setVisitData(prev => ({ ...prev, outcome: outcome as any, outcomeNotes }))
            }
          />
        )
      case 'quick-exam':
        return (
          <QuickExamTab
            examData={visitData.quickExam}
            onChange={(quickExam) => setVisitData(prev => ({ ...prev, quickExam }))}
          />
        )
      case 'immediate-treatment':
        return (
          <ImmediateTreatmentTab
            treatmentData={visitData.emergencyTreatment}
            onChange={(emergencyTreatment) => setVisitData(prev => ({ ...prev, emergencyTreatment }))}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-4">
      {/* Mode Selector Bar */}
      <div className="p-3 rounded-xl bg-card border border-border">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <ConsultationModeSelector
            activeMode={mode}
            onModeChange={setMode}
          />
          <div className="flex items-center gap-2">
            {modeConfig.fdiChartExpandable && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFdiChart(!showFdiChart)}
                className="border-border text-muted-foreground hover:text-foreground"
              >
                {showFdiChart ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                {showFdiChart ? 'Hide' : 'Show'} Dental Chart
              </Button>
            )}
            <Button
              onClick={() => handleSave('draft')}
              variant="outline"
              size="sm"
              disabled={isSaving}
              className="border-border"
            >
              <Save className="w-4 h-4 mr-1" />
              Save Draft
            </Button>
            <Button
              onClick={() => handleSave('completed')}
              size="sm"
              disabled={isSaving || isSaved}
              className="bg-primary text-primary-foreground"
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              {isSaved ? 'Saved' : isSaving ? 'Saving...' : 'Complete'}
            </Button>

            {/* Phase 4: Report generation buttons — appear after consultation is saved */}
            {isSaved && savedConsultationId && (
              <>
                <Button
                  onClick={() => handleGenerateReport({ saveToProfile: true })}
                  size="sm"
                  variant="outline"
                  disabled={isGeneratingReport}
                  className="border-teal-500/30 text-teal-400 hover:bg-teal-500/10"
                >
                  {isGeneratingReport ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : reportGenerated ? (
                    <CheckCircle className="w-4 h-4 mr-1" />
                  ) : (
                    <FileText className="w-4 h-4 mr-1" />
                  )}
                  {isGeneratingReport ? 'Generating...' : reportGenerated ? 'Report Saved' : 'Generate Report'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Episode Selector (if multiple episodes exist) */}
      {/* Session 10 Phase 3: Show appointment diagnosis context banner */}
      {appointmentContext && (appointmentContext.linkedDiagnosis || appointmentContext.linkedTreatmentPlan) && (
        <Card className="border-teal-500/30 bg-teal-500/5">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-teal-400 uppercase tracking-wider">Continuing From Previous Visit</span>
            </div>
            {appointmentContext.linkedDiagnosis && (
              <p className="text-sm text-foreground">
                <span className="text-muted-foreground">Diagnosis:</span> {appointmentContext.linkedDiagnosis}
              </p>
            )}
            {appointmentContext.linkedTreatmentPlan && (
              <p className="text-sm text-foreground">
                <span className="text-muted-foreground">Plan:</span> {appointmentContext.linkedTreatmentPlan}
              </p>
            )}
            {appointmentContext.linkedToothNumbers && appointmentContext.linkedToothNumbers.length > 0 && (
              <p className="text-sm text-foreground">
                <span className="text-muted-foreground">Teeth:</span> {appointmentContext.linkedToothNumbers.join(', ')}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {modeConfig.showEpisodeContext && activeEpisodes.length > 1 && !selectedEpisodeId && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-foreground">Select Treatment Episode</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activeEpisodes.map(ep => (
                <button
                  key={ep.id}
                  onClick={() => setSelectedEpisodeId(ep.id)}
                  className="w-full p-3 rounded-lg border border-border bg-card hover:bg-muted text-left transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{ep.original_diagnosis}</p>
                      <p className="text-xs text-muted-foreground">
                        Teeth: {(ep.linked_teeth || []).join(', ')} — {ep.treatment_plan}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs border-border">
                      {ep.completed_visits}/{ep.planned_visits} visits
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expandable FDI Chart */}
      {showFdiChart && props.selectedPatientId && (
        <Card className="border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-foreground">Dental Chart</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFdiChart(false)}
                className="text-muted-foreground"
              >
                <ChevronUp className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <InteractiveDentalChart
              patientId={props.selectedPatientId}
              onToothSelect={(toothNumber) => {
                console.log('Tooth selected:', toothNumber)
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* AI Tracking Assessment (treatment_visit & follow_up modes) */}
      {(mode === 'treatment_visit' || mode === 'follow_up') && selectedEpisodeId && (
        <div className="space-y-3">
          {/* Run Tracking Button */}
          {!trackingAssessment && !isTrackingLoading && (
            <Button
              onClick={runTracking}
              variant="outline"
              className="w-full border-primary/30 text-primary hover:bg-primary/10"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Run AI Treatment Assessment
            </Button>
          )}

          {/* Assessment Panel */}
          <TrackingAssessmentPanel
            assessment={trackingAssessment}
            isLoading={isTrackingLoading}
            mode={mode as 'treatment_visit' | 'follow_up'}
            onConfirm={handleConfirmAssessment}
            onDismiss={handleDismissAssessment}
            isConfirming={isConfirmingAssessment}
          />
        </div>
      )}

      {/* Tab Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {modeTabs.map(tab => {
          const Icon = tab.icon
          return (
            <Card
              key={tab.id}
              className="border-border hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => setActiveTabDialog(tab.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{tab.label}</p>
                    <p className="text-xs text-muted-foreground">Click to edit</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Tab Dialog */}
      <Dialog open={!!activeTabDialog} onOpenChange={() => setActiveTabDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {modeTabs.find(t => t.id === activeTabDialog)?.label || ''}
            </DialogTitle>
          </DialogHeader>
          {activeTabDialog && renderTabContent(activeTabDialog)}
        </DialogContent>
      </Dialog>
    </div>
  )
}
