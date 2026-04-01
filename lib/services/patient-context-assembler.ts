/**
 * Patient Context Assembler
 *
 * Assembles the FULL longitudinal patient context for AI pipeline consumption.
 * This is the critical bridge that makes the AI aware of the patient's complete
 * dental and medical history — not just the current conversation transcript.
 *
 * Called before the AI orchestrator pipeline runs, regardless of whether
 * the trigger was voice command or UI button click.
 *
 * Session 10 — Phase 1: Patient History → AI Pipeline
 */

import { createServiceClient } from '@/lib/supabase/server'

// =====================================================
// INTERFACES
// =====================================================

export interface PatientDemographics {
  age: number | null
  gender: string | null
  medicalConditions: string[]
  medications: string[]
  allergies: string[]
  habits: {
    smoking: string | null
    tobacco: string | null
    alcohol: string | null
    oralHygiene: string | null
  }
  medicalHistorySummary: string | null
}

export interface ToothHistoryEntry {
  date: string
  eventType: string          // diagnosis | treatment_start | treatment_visit | follow_up | status_change
  description: string
  status: string | null
  diagnosis: string | null
  treatment: string | null
  consultationId: string | null
  episodeId: string | null
}

export interface ToothContext {
  toothNumber: string
  currentStatus: string | null
  timeline: ToothHistoryEntry[]
  activeEpisode: {
    episodeId: string
    status: string
    diagnosis: string
    treatmentPlan: string
    completedVisits: number
    plannedVisits: number
    lastVisitDate: string | null
    lastVisitSummary: string | null
    combinedSequence: string | null
  } | null
  previousDiagnoses: string[]
  previousTreatments: string[]
}

export interface PreviousConsultationSummary {
  date: string
  mode: string
  chiefComplaint: string | null
  diagnoses: string[]
  treatmentsPerformed: string[]
  toothNumbers: string[]
  prescriptions: string[]
  followUpNotes: string | null
}

export interface ActiveEpisodeSummary {
  episodeId: string
  linkedTeeth: string[]
  diagnosis: string
  treatmentPlan: string
  status: string
  completedVisits: number
  plannedVisits: number
  combinedSequence: string | null
  nextSteps: string | null
}

export interface FullPatientContext {
  demographics: PatientDemographics
  toothContext: ToothContext | null         // specific tooth being examined (if known)
  allTeethStatus: Record<string, string>   // toothNumber → current status for all teeth
  previousConsultations: PreviousConsultationSummary[]
  activeEpisodes: ActiveEpisodeSummary[]
  visitCount: number
  lastVisitDate: string | null
}

// =====================================================
// MAIN ASSEMBLER
// =====================================================

/**
 * Assemble the full patient context for AI pipeline consumption.
 *
 * @param patientId - The patient's UUID
 * @param currentToothNumber - Optional: if known, assembles detailed history for this tooth
 * @param maxPreviousConsultations - Limit on how many past consultations to include (default 10)
 */
export async function assemblePatientContext(
  patientId: string,
  currentToothNumber?: string,
  maxPreviousConsultations: number = 10
): Promise<FullPatientContext> {
  const supabase = await createServiceClient()
  const startTime = Date.now()

  console.log(`\n📋 [PATIENT CONTEXT] Assembling context for patient ${patientId}${currentToothNumber ? `, tooth ${currentToothNumber}` : ''}`)

  // ── Parallel fetch: demographics, consultations, tooth data, episodes, timeline ──
  const [
    patientResult,
    consultationsResult,
    toothDiagnosesResult,
    episodesResult,
    timelineResult,
  ] = await Promise.all([
    // 1. Patient demographics
    supabase
      .from('patients')
      .select('id, first_name, last_name, date_of_birth, gender, medical_history_summary')
      .eq('id', patientId)
      .single(),

    // 2. Previous completed consultations (most recent first, limited)
    supabase
      .from('consultations')
      .select('id, consultation_date, status, chief_complaint, diagnosis, treatment_plan, consultation_mode, prescription_data, follow_up_data, clinical_data')
      .eq('patient_id', patientId)
      .eq('status', 'completed')
      .order('consultation_date', { ascending: false })
      .limit(maxPreviousConsultations),

    // 3. All tooth diagnoses for this patient (most recent per tooth)
    supabase
      .from('tooth_diagnoses')
      .select('tooth_number, status, primary_diagnosis, recommended_treatment, endodontic_diagnosis, restorative_diagnosis, combined_treatment_sequence, examination_date, consultation_id')
      .eq('patient_id', patientId)
      .order('examination_date', { ascending: false }),

    // 4. Treatment episodes
    supabase
      .from('treatment_episodes')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false }),

    // 5. Tooth timeline (for specific tooth if known, otherwise all)
    currentToothNumber
      ? supabase
          .from('tooth_timeline')
          .select('*')
          .eq('patient_id', patientId)
          .eq('tooth_number', currentToothNumber)
          .order('event_date', { ascending: false })
          .limit(50)
      : supabase
          .from('tooth_timeline')
          .select('*')
          .eq('patient_id', patientId)
          .order('event_date', { ascending: false })
          .limit(100),
  ])

  // ── Build demographics ──
  const demographics = buildDemographics(
    patientResult.data,
    consultationsResult.data
  )

  // ── Build all-teeth status map ──
  const allTeethStatus: Record<string, string> = {}
  const seenTeeth = new Set<string>()
  if (toothDiagnosesResult.data) {
    for (const td of toothDiagnosesResult.data) {
      // Only keep the most recent status per tooth (already sorted desc)
      if (!seenTeeth.has(td.tooth_number)) {
        allTeethStatus[td.tooth_number] = td.status || 'healthy'
        seenTeeth.add(td.tooth_number)
      }
    }
  }

  // ── Build specific tooth context ──
  let toothContext: ToothContext | null = null
  if (currentToothNumber) {
    toothContext = buildToothContext(
      currentToothNumber,
      toothDiagnosesResult.data || [],
      timelineResult.data || [],
      episodesResult.data || []
    )
  }

  // ── Build previous consultations summaries ──
  const previousConsultations = buildConsultationSummaries(
    consultationsResult.data || [],
    toothDiagnosesResult.data || []
  )

  // ── Build active episodes ──
  const activeEpisodes = buildActiveEpisodes(episodesResult.data || [])

  // ── Visit count and last visit ──
  const visitCount = consultationsResult.data?.length || 0
  const lastVisitDate = consultationsResult.data?.[0]?.consultation_date || null

  const elapsed = Date.now() - startTime
  console.log(`✅ [PATIENT CONTEXT] Assembled in ${elapsed}ms — ${visitCount} consultations, ${Object.keys(allTeethStatus).length} teeth with data, ${activeEpisodes.length} active episodes`)

  return {
    demographics,
    toothContext,
    allTeethStatus,
    previousConsultations,
    activeEpisodes,
    visitCount,
    lastVisitDate,
  }
}


// =====================================================
// HELPERS
// =====================================================

function buildDemographics(
  patient: any | null,
  consultations: any[] | null
): PatientDemographics {
  let age: number | null = null
  if (patient?.date_of_birth) {
    const dob = new Date(patient.date_of_birth)
    const today = new Date()
    age = today.getFullYear() - dob.getFullYear()
    const monthDiff = today.getMonth() - dob.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--
    }
  }

  // Extract medical info from most recent consultation's clinical_data
  let medicalConditions: string[] = []
  let medications: string[] = []
  let allergies: string[] = []
  let habits = { smoking: null as string | null, tobacco: null as string | null, alcohol: null as string | null, oralHygiene: null as string | null }

  if (consultations && consultations.length > 0) {
    // Find the most recent consultation with clinical_data that has medical info
    for (const c of consultations) {
      const cd = typeof c.clinical_data === 'string' ? tryParseJSON(c.clinical_data) : c.clinical_data
      if (!cd) continue

      // Medical conditions, medications, allergies
      if (cd.patient_info) {
        if (cd.patient_info.medical_history?.length && !medicalConditions.length) {
          medicalConditions = cd.patient_info.medical_history
        }
        if (cd.patient_info.medications?.length && !medications.length) {
          medications = cd.patient_info.medications
        }
        if (cd.patient_info.allergies?.length && !allergies.length) {
          allergies = cd.patient_info.allergies
        }
      }

      // Personal history / habits
      if (cd.personal_history && !habits.smoking) {
        const ph = cd.personal_history
        habits = {
          smoking: ph.smoking?.status || null,
          tobacco: ph.tobacco?.status || null,
          alcohol: ph.alcohol?.status || null,
          oralHygiene: ph.oral_hygiene?.brushing_frequency || null,
        }
      }

      // Once we have both, stop scanning
      if (medicalConditions.length && habits.smoking) break
    }
  }

  return {
    age,
    gender: patient?.gender || null,
    medicalConditions,
    medications,
    allergies,
    habits,
    medicalHistorySummary: patient?.medical_history_summary || null,
  }
}


function buildToothContext(
  toothNumber: string,
  allToothDiagnoses: any[],
  timelineEvents: any[],
  episodes: any[]
): ToothContext {
  // Filter diagnoses for this tooth
  const toothDiagnoses = allToothDiagnoses.filter(td => td.tooth_number === toothNumber)
  const currentStatus = toothDiagnoses[0]?.status || null

  // Build timeline entries
  const timeline: ToothHistoryEntry[] = timelineEvents.map(event => ({
    date: event.event_date,
    eventType: event.event_type,
    description: event.description || '',
    status: event.new_status || null,
    diagnosis: event.data_snapshot?.primary_diagnosis || event.data_snapshot?.diagnosis || null,
    treatment: event.data_snapshot?.recommended_treatment || event.data_snapshot?.treatment || null,
    consultationId: event.consultation_id || null,
    episodeId: event.episode_id || null,
  }))

  // Find active episode for this tooth
  let activeEpisode: ToothContext['activeEpisode'] = null
  for (const ep of episodes) {
    const linkedTeeth: string[] = Array.isArray(ep.linked_teeth) ? ep.linked_teeth : tryParseJSON(ep.linked_teeth) || []
    if (linkedTeeth.includes(toothNumber) && ['planned', 'in_progress'].includes(ep.status)) {
      activeEpisode = {
        episodeId: ep.id,
        status: ep.status,
        diagnosis: ep.original_diagnosis || '',
        treatmentPlan: ep.treatment_plan || '',
        completedVisits: ep.completed_visits || 0,
        plannedVisits: ep.planned_visits || 1,
        lastVisitDate: ep.updated_at || null,
        lastVisitSummary: ep.outcome_notes || null,
        combinedSequence: ep.combined_treatment_sequence || null,
      }
      break
    }
  }

  // Collect unique previous diagnoses and treatments
  const previousDiagnoses = [...new Set(
    toothDiagnoses
      .map(td => td.primary_diagnosis || td.endodontic_diagnosis)
      .filter(Boolean)
  )]
  const previousTreatments = [...new Set(
    toothDiagnoses
      .map(td => td.recommended_treatment)
      .filter(Boolean)
  )]

  return {
    toothNumber,
    currentStatus,
    timeline,
    activeEpisode,
    previousDiagnoses,
    previousTreatments,
  }
}


function buildConsultationSummaries(
  consultations: any[],
  toothDiagnoses: any[]
): PreviousConsultationSummary[] {
  return consultations.map(c => {
    const cd = typeof c.clinical_data === 'string' ? tryParseJSON(c.clinical_data) : c.clinical_data

    // Find teeth touched in this consultation
    const consultationTeeth = toothDiagnoses
      .filter(td => td.consultation_id === c.id)
      .map(td => td.tooth_number)

    const diagnoses = toothDiagnoses
      .filter(td => td.consultation_id === c.id && td.primary_diagnosis)
      .map(td => `${td.tooth_number}: ${td.primary_diagnosis}`)

    const treatments = toothDiagnoses
      .filter(td => td.consultation_id === c.id && td.recommended_treatment)
      .map(td => `${td.tooth_number}: ${td.recommended_treatment}`)

    // Extract prescriptions
    let prescriptions: string[] = []
    if (c.prescription_data) {
      const pd = typeof c.prescription_data === 'string' ? tryParseJSON(c.prescription_data) : c.prescription_data
      if (pd?.medications) {
        prescriptions = pd.medications.map((m: any) => m.name || m).filter(Boolean)
      }
    }

    // Extract follow-up notes
    let followUpNotes: string | null = null
    if (c.follow_up_data) {
      const fd = typeof c.follow_up_data === 'string' ? tryParseJSON(c.follow_up_data) : c.follow_up_data
      if (fd?.notes || fd?.instructions) {
        followUpNotes = fd.notes || fd.instructions
      }
    }

    return {
      date: c.consultation_date,
      mode: c.consultation_mode || 'new_consultation',
      chiefComplaint: c.chief_complaint || cd?.chief_complaint || null,
      diagnoses,
      treatmentsPerformed: treatments,
      toothNumbers: [...new Set(consultationTeeth)],
      prescriptions,
      followUpNotes,
    }
  })
}


function buildActiveEpisodes(episodes: any[]): ActiveEpisodeSummary[] {
  return episodes
    .filter(ep => ['planned', 'in_progress'].includes(ep.status))
    .map(ep => {
      const linkedTeeth: string[] = Array.isArray(ep.linked_teeth) ? ep.linked_teeth : tryParseJSON(ep.linked_teeth) || []

      // Determine next steps from sequence
      let nextSteps: string | null = null
      if (ep.combined_treatment_sequence && ep.completed_visits < ep.planned_visits) {
        const steps = ep.combined_treatment_sequence.split('→').map((s: string) => s.trim())
        const nextStepIndex = ep.completed_visits
        if (nextStepIndex < steps.length) {
          nextSteps = steps.slice(nextStepIndex).join(' → ')
        }
      }

      return {
        episodeId: ep.id,
        linkedTeeth,
        diagnosis: ep.original_diagnosis || '',
        treatmentPlan: ep.treatment_plan || '',
        status: ep.status,
        completedVisits: ep.completed_visits || 0,
        plannedVisits: ep.planned_visits || 1,
        combinedSequence: ep.combined_treatment_sequence || null,
        nextSteps,
      }
    })
}


// =====================================================
// FORMAT FOR AI PROMPT
// =====================================================

/**
 * Format the full patient context into a text block suitable for injection
 * into the synthesis agent's prompt.
 *
 * This replaces the thin PatientHistory formatting in buildUserPrompt().
 */
export function formatPatientContextForPrompt(context: FullPatientContext): string {
  const lines: string[] = []

  // ── Demographics ──
  const d = context.demographics
  const ageLine = d.age ? `Age: ${d.age}` : 'Age: unknown'
  const genderLine = d.gender ? `, ${d.gender}` : ''
  lines.push(`${ageLine}${genderLine}`)

  if (d.medicalConditions.length) {
    lines.push(`Medical Conditions: ${d.medicalConditions.join(', ')}`)
  }
  if (d.medications.length) {
    lines.push(`Current Medications: ${d.medications.join(', ')}`)
  }
  if (d.allergies.length) {
    lines.push(`Allergies: ${d.allergies.join(', ')}`)
  }
  if (d.habits.smoking || d.habits.tobacco || d.habits.alcohol) {
    const habitParts: string[] = []
    if (d.habits.smoking) habitParts.push(`Smoking: ${d.habits.smoking}`)
    if (d.habits.tobacco) habitParts.push(`Tobacco: ${d.habits.tobacco}`)
    if (d.habits.alcohol) habitParts.push(`Alcohol: ${d.habits.alcohol}`)
    lines.push(`Habits: ${habitParts.join(', ')}`)
  }
  if (d.habits.oralHygiene) {
    lines.push(`Oral Hygiene: brushing ${d.habits.oralHygiene}`)
  }
  if (d.medicalHistorySummary) {
    lines.push(`Medical Summary: ${d.medicalHistorySummary}`)
  }

  // ── Visit history ──
  lines.push(`\nTotal visits: ${context.visitCount}${context.lastVisitDate ? `, last visit: ${new Date(context.lastVisitDate).toLocaleDateString()}` : ''}`)

  // ── Specific tooth context (if examining a particular tooth) ──
  if (context.toothContext) {
    const tc = context.toothContext
    lines.push(`\n--- TOOTH ${tc.toothNumber} HISTORY ---`)
    lines.push(`Current status: ${tc.currentStatus || 'no prior record'}`)

    if (tc.previousDiagnoses.length) {
      lines.push(`Previous diagnoses: ${tc.previousDiagnoses.join('; ')}`)
    }
    if (tc.previousTreatments.length) {
      lines.push(`Previous treatments: ${tc.previousTreatments.join('; ')}`)
    }

    if (tc.activeEpisode) {
      const ae = tc.activeEpisode
      lines.push(`Active episode: ${ae.diagnosis} — ${ae.status}`)
      lines.push(`  Treatment plan: ${ae.treatmentPlan}`)
      lines.push(`  Progress: ${ae.completedVisits}/${ae.plannedVisits} visits`)
      if (ae.combinedSequence) {
        lines.push(`  Sequence: ${ae.combinedSequence}`)
      }
      if (ae.lastVisitSummary) {
        lines.push(`  Last visit notes: ${ae.lastVisitSummary}`)
      }
    }

    if (tc.timeline.length > 0) {
      lines.push(`Timeline (${Math.min(tc.timeline.length, 10)} most recent):`)
      for (const entry of tc.timeline.slice(0, 10)) {
        const date = new Date(entry.date).toLocaleDateString()
        const parts = [date, entry.eventType]
        if (entry.diagnosis) parts.push(`dx: ${entry.diagnosis}`)
        if (entry.treatment) parts.push(`tx: ${entry.treatment}`)
        if (entry.status) parts.push(`→ ${entry.status}`)
        lines.push(`  ${parts.join(' | ')}`)
      }
    }
  }

  // ── Active episodes (all teeth) ──
  if (context.activeEpisodes.length > 0) {
    lines.push(`\n--- ACTIVE TREATMENT EPISODES (${context.activeEpisodes.length}) ---`)
    for (const ep of context.activeEpisodes) {
      lines.push(`Teeth ${ep.linkedTeeth.join(',')}: ${ep.diagnosis} — ${ep.status} (${ep.completedVisits}/${ep.plannedVisits} visits)`)
      if (ep.nextSteps) {
        lines.push(`  Next: ${ep.nextSteps}`)
      }
    }
  }

  // ── Previous consultations (brief) ──
  if (context.previousConsultations.length > 0) {
    const limit = Math.min(context.previousConsultations.length, 5)
    lines.push(`\n--- RECENT CONSULTATIONS (${limit} of ${context.previousConsultations.length}) ---`)
    for (const pc of context.previousConsultations.slice(0, limit)) {
      const date = new Date(pc.date).toLocaleDateString()
      const complaint = pc.chiefComplaint ? pc.chiefComplaint.substring(0, 80) : 'no chief complaint'
      lines.push(`${date} [${pc.mode}]: ${complaint}`)
      if (pc.diagnoses.length) {
        lines.push(`  Diagnoses: ${pc.diagnoses.join('; ')}`)
      }
      if (pc.treatmentsPerformed.length) {
        lines.push(`  Treatments: ${pc.treatmentsPerformed.join('; ')}`)
      }
    }
  }

  // ── All teeth status overview ──
  const teethWithIssues = Object.entries(context.allTeethStatus)
    .filter(([_, status]) => status !== 'healthy')
  if (teethWithIssues.length > 0) {
    lines.push(`\n--- DENTAL STATUS OVERVIEW ---`)
    const byStatus: Record<string, string[]> = {}
    for (const [tooth, status] of teethWithIssues) {
      if (!byStatus[status]) byStatus[status] = []
      byStatus[status].push(tooth)
    }
    for (const [status, teeth] of Object.entries(byStatus)) {
      lines.push(`${status}: teeth ${teeth.join(', ')}`)
    }
  }

  return lines.join('\n')
}


// =====================================================
// UTILITY
// =====================================================

function tryParseJSON(str: any): any {
  if (!str) return null
  if (typeof str !== 'string') return str
  try {
    return JSON.parse(str)
  } catch {
    return null
  }
}
