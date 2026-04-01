/**
 * MCP Conductor Agent — Multi-Step Command Orchestrator
 *
 * Session 14: Handles multi-step voice/text commands by decomposing them
 * into sequential steps, executing each with verification, and streaming
 * status updates back to the UI.
 *
 * Example: "Start consultation with Popatlal Pandey"
 * → Step 1: Search patient database → found
 * → Step 2: Navigate to clinical mode → done
 * → Step 3: Select patient → done
 * → Step 4: Start recording → done
 *
 * NOT to be confused with conductor-agent.ts which is the diagnostic
 * N-track cross-domain synthesizer.
 */

import { createServiceClient } from '@/lib/supabase/server'

// =====================================================
// TYPES
// =====================================================

export interface ConductorStep {
  id: string
  label: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  result?: any
  error?: string
  durationMs?: number
}

export interface ConductorResult {
  success: boolean
  steps: ConductorStep[]
  finalMessage: string
  actionCommands: ActionCommandPayload[]
  totalDurationMs: number
}

export interface ActionCommandPayload {
  action: string
  [key: string]: any
}

export interface ConductorCallbacks {
  onStepStart?: (step: ConductorStep) => void
  onStepComplete?: (step: ConductorStep) => void
  onStepFailed?: (step: ConductorStep) => void
  onSpeak?: (text: string) => void
}

// =====================================================
// STEP DEFINITIONS — what each intent decomposes into
// =====================================================

interface StepDefinition {
  id: string
  label: string
  execute: (context: StepContext) => Promise<StepResult>
  onFailure: 'retry' | 'skip' | 'abort'
}

interface StepContext {
  dentistId: string
  entities: Record<string, any>
  previousResults: Map<string, any>
}

interface StepResult {
  success: boolean
  data?: any
  error?: string
}

// =====================================================
// MULTI-STEP DETECTION
// =====================================================

/**
 * Determine if an intent requires multi-step orchestration.
 * Single-step intents are handled directly by the master AI.
 */
export function isMultiStepIntent(intentType: string, entities: Record<string, any>): boolean {
  switch (intentType) {
    case 'consultation_start':
      // Multi-step when a patient name is provided (need to search, navigate, select, record)
      return !!entities.patientName
    case 'appointment_book':
      // Multi-step when patient name given (need to search patient, then book)
      return !!entities.patientName
    case 'task_command':
      // Multi-step when patient-linked task (need to find patient, then create task)
      return !!entities.patientName && /create|assign|add/i.test(entities.taskAction || '')
    default:
      return false
  }
}

// =====================================================
// STEP FACTORIES — create step sequences per intent
// =====================================================

function buildConsultationStartSteps(entities: Record<string, any>): StepDefinition[] {
  const steps: StepDefinition[] = []

  // Step 1: Search patient
  if (entities.patientName) {
    steps.push({
      id: 'search_patient',
      label: `Searching for ${entities.patientName}...`,
      onFailure: 'abort',
      execute: async (ctx) => {
        const supabase = await createServiceClient()

        // Session 15: Fuzzy search for voice-friendly name matching
        try {
          const { fuzzySearchPatients } = await import('@/lib/utils/fuzzy-patient-search')
          const fuzzyResult = await fuzzySearchPatients(supabase, entities.patientName, { schema: 'api' })

          if (fuzzyResult.bestMatch) {
            return {
              success: true,
              data: {
                patientId: fuzzyResult.bestMatch.id,
                patientName: `${fuzzyResult.bestMatch.first_name} ${fuzzyResult.bestMatch.last_name}`.trim(),
                source: 'patients',
                confidence: fuzzyResult.bestMatch.score,
              }
            }
          }

          // No confident match — if we have candidates, return them for confirmation
          if (fuzzyResult.patients.length > 0) {
            return {
              success: false,
              error: `Patient "${entities.patientName}" not found. Similar: ${fuzzyResult.patients.slice(0, 3).map(p => `${p.first_name} ${p.last_name}`).join(', ')}`,
              data: { candidates: fuzzyResult.patients.slice(0, 3) }
            }
          }

          // No candidates at all — try profiles as last resort
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .ilike('full_name', `%${entities.patientName}%`)
            .eq('role', 'patient')
            .limit(5)

          if (profiles && profiles.length > 0) {
            return {
              success: true,
              data: { patientId: profiles[0].id, patientName: profiles[0].full_name, source: 'profiles' }
            }
          }

          return { success: false, error: `Patient "${entities.patientName}" not found` }
        } catch (fuzzyError: any) {
          // Fallback: original ilike search if fuzzy utility fails
          console.warn('⚠️ [MCP CONDUCTOR] Fuzzy search failed, falling back to ilike:', fuzzyError.message)
          const searchName = entities.patientName.toLowerCase()
          const { data: patients, error } = await supabase
            .schema('api')
            .from('patients')
            .select('id, first_name, last_name')
            .or(`first_name.ilike.%${searchName}%,last_name.ilike.%${searchName}%`)
            .limit(5)
          if (error) return { success: false, error: `Database error: ${error.message}` }
          if (!patients || patients.length === 0) {
            return { success: false, error: `Patient "${entities.patientName}" not found` }
          }
          return {
            success: true,
            data: { patientId: patients[0].id, patientName: `${patients[0].first_name} ${patients[0].last_name}`.trim(), source: 'patients' }
          }
        }
      }
    })
  }

  // Step 2: Check for today's appointment
  steps.push({
    id: 'check_appointment',
    label: 'Checking today\'s appointments...',
    onFailure: 'skip', // Not critical — can start without appointment
    execute: async (ctx) => {
      const patientData = ctx.previousResults.get('search_patient')
      if (!patientData?.data?.patientId) return { success: true, data: { appointmentFound: false } }

      const supabase = await createServiceClient()
      const today = new Date().toISOString().split('T')[0]

      const { data: appointments } = await supabase
        .schema('api')
        .from('appointments')
        .select('id, appointment_type, status')
        .eq('patient_id', patientData.data.patientId)
        .gte('scheduled_date', today)
        .lte('scheduled_date', today + 'T23:59:59')
        .in('status', ['scheduled', 'confirmed', 'checked_in'])
        .limit(1)

      if (appointments && appointments.length > 0) {
        return {
          success: true,
          data: {
            appointmentFound: true,
            appointmentId: appointments[0].id,
            appointmentType: appointments[0].appointment_type
          }
        }
      }

      return { success: true, data: { appointmentFound: false } }
    }
  })

  // Step 3: Navigate to clinical mode
  steps.push({
    id: 'navigate_clinical',
    label: 'Opening clinical mode...',
    onFailure: 'abort',
    execute: async () => {
      // This step produces an action command for the frontend
      return {
        success: true,
        data: { action: 'navigate', targetMode: 'clinical' }
      }
    }
  })

  // Step 4: Select patient and start recording
  steps.push({
    id: 'start_consultation',
    label: 'Starting consultation...',
    onFailure: 'abort',
    execute: async (ctx) => {
      const patientData = ctx.previousResults.get('search_patient')
      const appointmentData = ctx.previousResults.get('check_appointment')

      return {
        success: true,
        data: {
          action: 'consultation_start',
          patientId: patientData?.data?.patientId,
          patientName: patientData?.data?.patientName,
          appointmentId: appointmentData?.data?.appointmentId,
          appointmentType: appointmentData?.data?.appointmentType,
          startRecording: true
        }
      }
    }
  })

  return steps
}

function buildAppointmentBookSteps(entities: Record<string, any>): StepDefinition[] {
  const steps: StepDefinition[] = []

  // Step 1: Search patient
  if (entities.patientName) {
    steps.push({
      id: 'search_patient',
      label: `Looking up ${entities.patientName}...`,
      onFailure: 'abort',
      execute: async () => {
        const supabase = await createServiceClient()
        const searchName = entities.patientName.toLowerCase()

        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .ilike('full_name', `%${searchName}%`)
          .eq('role', 'patient')
          .limit(5)

        if (profiles && profiles.length > 0) {
          return { success: true, data: { patientId: profiles[0].id, patientName: profiles[0].full_name } }
        }
        return { success: false, error: `Patient "${entities.patientName}" not found` }
      }
    })
  }

  // Step 2: Navigate to appointment booking
  steps.push({
    id: 'navigate_booking',
    label: 'Opening appointment scheduler...',
    onFailure: 'abort',
    execute: async () => {
      return { success: true, data: { action: 'navigate', targetMode: 'pms', targetTab: 'appointments' } }
    }
  })

  // Step 3: Pre-fill appointment data
  steps.push({
    id: 'prefill_appointment',
    label: 'Preparing appointment details...',
    onFailure: 'skip',
    execute: async (ctx) => {
      const patientData = ctx.previousResults.get('search_patient')
      return {
        success: true,
        data: {
          action: 'appointment_book',
          patientId: patientData?.data?.patientId,
          patientName: patientData?.data?.patientName,
          appointmentDate: entities.appointmentDate,
          appointmentTime: entities.appointmentTime,
          treatmentType: entities.treatmentType,
          reason: entities.appointmentReason,
        }
      }
    }
  })

  return steps
}

// =====================================================
// CONDUCTOR ENGINE
// =====================================================

/**
 * Execute a multi-step command through the conductor pipeline.
 *
 * @param intentType - Classified intent from master AI
 * @param entities - Extracted entities (patientName, toothNumber, etc.)
 * @param dentistId - Authenticated dentist's user ID
 * @param callbacks - Optional callbacks for streaming status to UI
 */
export async function executeConductorPipeline(
  intentType: string,
  entities: Record<string, any>,
  dentistId: string,
  callbacks?: ConductorCallbacks
): Promise<ConductorResult> {
  const startTime = Date.now()

  // Build step sequence based on intent
  let stepDefs: StepDefinition[]
  switch (intentType) {
    case 'consultation_start':
      stepDefs = buildConsultationStartSteps(entities)
      break
    case 'appointment_book':
      stepDefs = buildAppointmentBookSteps(entities)
      break
    default:
      return {
        success: false,
        steps: [],
        finalMessage: `No multi-step pipeline defined for intent: ${intentType}`,
        actionCommands: [],
        totalDurationMs: Date.now() - startTime,
      }
  }

  // Execute steps sequentially
  const completedSteps: ConductorStep[] = []
  const previousResults = new Map<string, StepResult>()
  const actionCommands: ActionCommandPayload[] = []
  const context: StepContext = { dentistId, entities, previousResults }

  console.log(`🎯 [CONDUCTOR] Starting ${stepDefs.length}-step pipeline for ${intentType}`)

  for (const stepDef of stepDefs) {
    const step: ConductorStep = {
      id: stepDef.id,
      label: stepDef.label,
      status: 'running',
    }

    // Notify: step starting
    callbacks?.onStepStart?.(step)
    callbacks?.onSpeak?.(`${stepDef.label.replace(/\.\.\.$/, '')}`)
    const stepStart = Date.now()

    try {
      // Execute step
      let result = await stepDef.execute(context)

      // Retry once on failure if policy allows
      if (!result.success && stepDef.onFailure === 'retry') {
        console.log(`🔄 [CONDUCTOR] Retrying step: ${stepDef.id}`)
        await new Promise(r => setTimeout(r, 500)) // brief delay
        result = await stepDef.execute(context)
      }

      step.durationMs = Date.now() - stepStart

      if (result.success) {
        step.status = 'completed'
        step.result = result.data
        previousResults.set(stepDef.id, result)
        callbacks?.onStepComplete?.(step)

        // Collect action commands from steps that produce them
        if (result.data?.action) {
          actionCommands.push(result.data)
        }

        console.log(`✅ [CONDUCTOR] Step ${stepDef.id} completed in ${step.durationMs}ms`)
      } else {
        step.status = 'failed'
        step.error = result.error
        callbacks?.onStepFailed?.(step)

        console.log(`❌ [CONDUCTOR] Step ${stepDef.id} failed: ${result.error}`)

        if (stepDef.onFailure === 'abort') {
          completedSteps.push(step)
          break
        }
        // Skip: continue to next step
        step.status = 'skipped'
      }
    } catch (error: any) {
      step.status = 'failed'
      step.error = error.message || 'Unknown error'
      step.durationMs = Date.now() - stepStart
      callbacks?.onStepFailed?.(step)

      console.error(`💥 [CONDUCTOR] Step ${stepDef.id} threw:`, error.message)

      if (stepDef.onFailure === 'abort') {
        completedSteps.push(step)
        break
      }
    }

    completedSteps.push(step)
  }

  // Build final message
  const allSucceeded = completedSteps.every(s => s.status === 'completed' || s.status === 'skipped')
  const failedSteps = completedSteps.filter(s => s.status === 'failed')
  const totalDuration = Date.now() - startTime

  let finalMessage: string
  if (allSucceeded) {
    // Build success message from step results
    const patientResult = previousResults.get('search_patient')
    const appointmentResult = previousResults.get('check_appointment')

    if (intentType === 'consultation_start') {
      const name = patientResult?.data?.patientName || entities.patientName
      const hasAppt = appointmentResult?.data?.appointmentFound
      finalMessage = `Consultation started with ${name}.${hasAppt ? ' Today\'s appointment linked.' : ''} Recording is active.`
    } else if (intentType === 'appointment_book') {
      const name = patientResult?.data?.patientName || entities.patientName
      finalMessage = `Opening appointment scheduler for ${name}.`
    } else {
      finalMessage = `All ${completedSteps.length} steps completed successfully.`
    }
  } else {
    finalMessage = `Pipeline partially completed. ${failedSteps.length} step(s) failed: ${failedSteps.map(s => s.error).join(', ')}`
  }

  console.log(`🏁 [CONDUCTOR] Pipeline finished in ${totalDuration}ms — ${allSucceeded ? 'SUCCESS' : 'PARTIAL'}`)

  return {
    success: allSucceeded,
    steps: completedSteps,
    finalMessage,
    actionCommands,
    totalDurationMs: totalDuration,
  }
}
