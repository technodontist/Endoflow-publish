/**
 * Consultation Sync Engine
 *
 * Automatically syncs consultation data to the longitudinal patient profile:
 * - Creates tooth_timeline entries for status changes and new diagnoses
 * - Auto-creates treatment episodes for teeth with treatment plans
 * - Logs episode visits for treatment/follow-up consultations
 *
 * Called after a consultation is finalized. Fully try/catch wrapped —
 * failures are logged but never block the consultation save.
 */

import { createServiceClient } from '@/lib/supabase/server'

// Gap 1 Fix: Map tooth status to FDI chart color codes
function getStatusColorCode(status: string): string {
  const colorMap: Record<string, string> = {
    healthy: '#22c55e',       // green
    caries: '#ef4444',        // red
    filled: '#3b82f6',        // blue
    crown: '#8b5cf6',         // purple
    missing: '#6b7280',       // gray
    attention: '#f97316',     // orange
    root_canal: '#eab308',    // yellow
    extraction_needed: '#dc2626', // dark red
    implant: '#06b6d4',       // cyan
  }
  return colorMap[status] || '#f97316' // default orange for unknown
}

interface SyncParams {
  consultationId: string
  patientId: string
  dentistId: string
  consultationMode: 'new_consultation' | 'treatment_visit' | 'follow_up' | 'emergency'
  episodeId?: string // If this consultation is part of an existing episode
  toothData: { [toothNumber: string]: any }
  status: 'draft' | 'completed' | 'archived'
  appointmentId?: string
}

export async function syncConsultationToPatientProfile(params: SyncParams): Promise<void> {
  // Only sync completed consultations
  if (params.status !== 'completed') {
    console.log('⏭️ [SYNC] Skipping sync — consultation not completed (status:', params.status, ')')
    return
  }

  console.log('🔄 [SYNC] Starting consultation sync for patient:', params.patientId, 'mode:', params.consultationMode)

  const supabase = await createServiceClient()

  // Step 1: Fetch the patient's current tooth statuses (before this consultation)
  const previousStatuses = await fetchPreviousToothStatuses(supabase, params.patientId)

  // Step 2: Process each tooth in the consultation
  const toothEntries = Object.entries(params.toothData || {})
  let timelineEventsCreated = 0
  let episodesCreated = 0

  for (const [toothNumber, toothInfo] of toothEntries) {
    if (!toothInfo) continue

    const hasDiagnosis = toothInfo.selectedDiagnoses?.length > 0 || toothInfo.primaryDiagnosis
    const hasTreatment = toothInfo.selectedTreatments?.length > 0 || toothInfo.recommendedTreatment
    const currentStatus = toothInfo.currentStatus || toothInfo.status || 'healthy'
    const previousStatus = previousStatuses[toothNumber] || null
    const statusChanged = previousStatus && previousStatus !== currentStatus

    // 2a: Detect status changes → create timeline event
    if (statusChanged) {
      try {
        await supabase
          .schema('api')
          .from('tooth_timeline')
          .insert({
            patient_id: params.patientId,
            tooth_number: toothNumber,
            event_type: 'status_change',
            episode_id: params.episodeId || null,
            consultation_id: params.consultationId,
            event_date: new Date().toISOString(),
            description: `Status changed from ${previousStatus} to ${currentStatus}`,
            previous_status: previousStatus,
            new_status: currentStatus,
            data_snapshot: {
              diagnosis: toothInfo.selectedDiagnoses || toothInfo.primaryDiagnosis,
              treatment: toothInfo.selectedTreatments || toothInfo.recommendedTreatment,
            },
            created_by: params.dentistId,
          })
        timelineEventsCreated++
      } catch (e) {
        console.warn('⚠️ [SYNC] Failed to create status_change timeline event for tooth', toothNumber, e)
      }
    }

    // 2b: New diagnosis recorded → create timeline event
    if (hasDiagnosis) {
      const diagnosisText = Array.isArray(toothInfo.selectedDiagnoses)
        ? toothInfo.selectedDiagnoses.join(', ')
        : toothInfo.primaryDiagnosis || 'Diagnosis recorded'

      try {
        await supabase
          .schema('api')
          .from('tooth_timeline')
          .insert({
            patient_id: params.patientId,
            tooth_number: toothNumber,
            event_type: 'diagnosis',
            episode_id: params.episodeId || null,
            consultation_id: params.consultationId,
            event_date: new Date().toISOString(),
            description: `Diagnosed: ${diagnosisText}`,
            previous_status: previousStatus,
            new_status: currentStatus,
            data_snapshot: {
              diagnosis: toothInfo.selectedDiagnoses || toothInfo.primaryDiagnosis,
              diagnosisDetails: toothInfo.diagnosisDetails,
              treatment: toothInfo.selectedTreatments || toothInfo.recommendedTreatment,
              treatmentDetails: toothInfo.treatmentDetails,
              combinedSequence: toothInfo.combinedTreatmentSequence,
              priority: toothInfo.priority || toothInfo.treatmentPriority,
            },
            created_by: params.dentistId,
          })
        timelineEventsCreated++
      } catch (e) {
        console.warn('⚠️ [SYNC] Failed to create diagnosis timeline event for tooth', toothNumber, e)
      }
    }

    // Gap 1 Fix: Bridge old and new systems — upsert tooth_diagnoses so FDI chart reflects current status
    if (statusChanged || hasDiagnosis) {
      try {
        const diagnosisText = Array.isArray(toothInfo.selectedDiagnoses)
          ? toothInfo.selectedDiagnoses.join(', ')
          : toothInfo.primaryDiagnosis || null
        const treatmentText = Array.isArray(toothInfo.selectedTreatments)
          ? toothInfo.selectedTreatments.join(', ')
          : toothInfo.recommendedTreatment || null

        await supabase
          .schema('api')
          .from('tooth_diagnoses')
          .upsert({
            consultation_id: params.consultationId,
            patient_id: params.patientId,
            tooth_number: toothNumber,
            status: currentStatus || 'attention',
            color_code: getStatusColorCode(currentStatus || 'attention'),
            primary_diagnosis: diagnosisText,
            recommended_treatment: treatmentText,
            treatment_priority: toothInfo.priority || toothInfo.treatmentPriority || 'medium',
            diagnosis_details: toothInfo.diagnosisDetails || null,
            treatment_details: toothInfo.treatmentDetails || null,
            combined_treatment_sequence: toothInfo.combinedTreatmentSequence || null,
            examination_date: new Date().toISOString().split('T')[0],
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'consultation_id,tooth_number',
          })

        console.log(`🎨 [SYNC] Updated tooth_diagnoses for tooth ${toothNumber} → ${currentStatus} (${getStatusColorCode(currentStatus || 'attention')})`)
      } catch (e) {
        console.warn('⚠️ [SYNC] Failed to upsert tooth_diagnoses for tooth', toothNumber, e)
      }
    }

    // 2c: Auto-create treatment episode for new consultations with treatment plans
    if (
      params.consultationMode === 'new_consultation' &&
      !params.episodeId &&
      hasTreatment &&
      hasDiagnosis
    ) {
      try {
        const diagnosis = Array.isArray(toothInfo.selectedDiagnoses)
          ? toothInfo.selectedDiagnoses.join(', ')
          : toothInfo.primaryDiagnosis || 'Unspecified'

        const treatment = Array.isArray(toothInfo.selectedTreatments)
          ? toothInfo.selectedTreatments.join(', ')
          : toothInfo.recommendedTreatment || 'Unspecified'

        const sequence = toothInfo.combinedTreatmentSequence || null

        // Estimate planned visits from the treatment sequence
        const plannedVisits = estimatePlannedVisits(sequence, treatment)

        const { data: episode, error: epError } = await supabase
          .schema('api')
          .from('treatment_episodes')
          .insert({
            patient_id: params.patientId,
            dentist_id: params.dentistId,
            episode_type: 'single_tooth',
            linked_teeth: [toothNumber],
            original_diagnosis: diagnosis,
            original_diagnosis_consultation_id: params.consultationId,
            treatment_plan: treatment,
            combined_treatment_sequence: sequence,
            planned_visits: plannedVisits,
            status: 'planned',
            priority: toothInfo.priority || toothInfo.treatmentPriority || 'medium',
          })
          .select('id')
          .single()

        if (!epError && episode) {
          episodesCreated++

          // Add treatment_start timeline event
          await supabase
            .schema('api')
            .from('tooth_timeline')
            .insert({
              patient_id: params.patientId,
              tooth_number: toothNumber,
              event_type: 'treatment_start',
              episode_id: episode.id,
              consultation_id: params.consultationId,
              event_date: new Date().toISOString(),
              description: `Treatment episode created: ${treatment}`,
              new_status: currentStatus,
              data_snapshot: {
                episodeId: episode.id,
                diagnosis,
                treatment,
                sequence,
                plannedVisits,
              },
              created_by: params.dentistId,
            })
          timelineEventsCreated++

          // Session 10 Phase 3: Link any scheduled appointments for this patient+tooth to the new episode
          try {
            await supabase
              .schema('api')
              .from('appointments')
              .update({
                linked_episode_id: episode.id,
                linked_tooth_numbers: JSON.stringify([toothNumber]),
                linked_diagnosis: diagnosis,
                linked_treatment_plan: treatment,
              })
              .eq('patient_id', params.patientId)
              .eq('status', 'scheduled')
              .ilike('appointment_type', `%Tooth ${toothNumber}%`)
              .is('linked_episode_id', null)
          } catch (linkErr) {
            console.warn('⚠️ [SYNC] Failed to link appointments to episode:', linkErr)
          }
        }
      } catch (e) {
        console.warn('⚠️ [SYNC] Failed to auto-create episode for tooth', toothNumber, e)
      }
    }
  }

  // Step 3: If this is a treatment/follow-up visit linked to an episode, log the visit
  if (params.episodeId && (params.consultationMode === 'treatment_visit' || params.consultationMode === 'follow_up')) {
    try {
      // Get current episode to determine visit number
      const { data: episode } = await supabase
        .schema('api')
        .from('treatment_episodes')
        .select('completed_visits, planned_visits, status')
        .eq('id', params.episodeId)
        .single()

      if (episode) {
        const visitNumber = episode.completed_visits + 1
        const visitType = params.consultationMode === 'follow_up' ? 'follow_up' : 'treatment'

        // Create episode visit
        await supabase
          .schema('api')
          .from('episode_visits')
          .insert({
            episode_id: params.episodeId,
            consultation_id: params.consultationId,
            appointment_id: params.appointmentId || null,
            visit_number: visitNumber,
            visit_type: visitType,
            visit_date: new Date().toISOString(),
            dentist_confirmed: false,
          })

        // Update episode: increment visits, update status
        const newCompletedVisits = visitNumber
        const episodeUpdate: Record<string, unknown> = {
          completed_visits: newCompletedVisits,
        }

        if (episode.status === 'planned') {
          episodeUpdate.status = 'in_progress'
          episodeUpdate.started_at = new Date().toISOString()
        }

        if (newCompletedVisits >= episode.planned_visits) {
          episodeUpdate.status = 'completed'
          episodeUpdate.completed_at = new Date().toISOString()
        }

        await supabase
          .schema('api')
          .from('treatment_episodes')
          .update(episodeUpdate)
          .eq('id', params.episodeId)

        console.log(`✅ [SYNC] Logged ${visitType} visit #${visitNumber} for episode ${params.episodeId}`)

        // Add timeline events for all linked teeth
        const { data: ep } = await supabase
          .schema('api')
          .from('treatment_episodes')
          .select('linked_teeth')
          .eq('id', params.episodeId)
          .single()

        if (ep?.linked_teeth) {
          const eventType = params.consultationMode === 'follow_up' ? 'follow_up' : 'treatment_visit'
          for (const tooth of ep.linked_teeth) {
            await supabase
              .schema('api')
              .from('tooth_timeline')
              .insert({
                patient_id: params.patientId,
                tooth_number: tooth,
                event_type: eventType,
                episode_id: params.episodeId,
                consultation_id: params.consultationId,
                event_date: new Date().toISOString(),
                description: `${visitType === 'follow_up' ? 'Follow-up' : 'Treatment'} visit #${visitNumber}`,
                created_by: params.dentistId,
              })
            timelineEventsCreated++
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ [SYNC] Failed to log episode visit:', e)
    }
  }

  console.log(
    `✅ [SYNC] Complete — ${timelineEventsCreated} timeline events, ${episodesCreated} episodes created`
  )
}

/**
 * Fetch the most recent status for each tooth from the latest_tooth_diagnoses view
 */
async function fetchPreviousToothStatuses(
  supabase: any,
  patientId: string
): Promise<Record<string, string>> {
  try {
    const { data, error } = await supabase
      .schema('api')
      .from('latest_tooth_diagnoses')
      .select('tooth_number, status')
      .eq('patient_id', patientId)

    if (error || !data) return {}

    const statuses: Record<string, string> = {}
    for (const row of data) {
      statuses[row.tooth_number] = row.status
    }
    return statuses
  } catch {
    return {}
  }
}

/**
 * Estimate the number of planned visits from the treatment sequence or type.
 * This is a heuristic — the dentist can adjust later.
 */
function estimatePlannedVisits(sequence: string | null, treatment: string): number {
  // If there's a numbered sequence like "1. RCT → 2. Post & Core → 3. Crown"
  if (sequence) {
    const steps = sequence.split('→').length
    if (steps > 1) return steps
    // Also try numbered pattern
    const numberedSteps = sequence.match(/\d+\./g)
    if (numberedSteps && numberedSteps.length > 1) return numberedSteps.length
  }

  // Heuristic based on treatment type
  const t = treatment.toLowerCase()
  if (t.includes('rct') || t.includes('root canal')) return 3
  if (t.includes('fpd') || t.includes('bridge') || t.includes('crown')) return 3
  if (t.includes('implant')) return 4
  if (t.includes('extraction')) return 1
  if (t.includes('filling') || t.includes('composite') || t.includes('restoration')) return 1
  if (t.includes('scaling') || t.includes('cleaning')) return 1
  if (t.includes('denture')) return 4

  return 1 // Default single visit
}
