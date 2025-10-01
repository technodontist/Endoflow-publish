'use server'

import { createServiceClient, createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Consultation, NewConsultation, ToothDiagnosis, NewToothDiagnosis, VoiceSession, NewVoiceSession } from '@/lib/db/schema'

interface ConsultationFormData {
  patientId: string
  dentistId: string

  // Pain Assessment
  chiefComplaint?: string
  painAssessment?: any

  // Medical History
  medicalHistory?: any

  // Clinical Examination
  clinicalExamination?: any

  // Investigations
  investigations?: any

  // Diagnosis
  diagnosis?: any

  // Treatment Plan
  treatmentPlan?: any

  // Other fields
  prognosis?: string
  prescriptionData?: any
  followUpData?: any
  additionalNotes?: string
  status?: 'draft' | 'completed' | 'archived'
}

// Internal helper to sync patient-side alarms and appointments
async function syncPatientSideFromConsultationInternal(payload: { patientId: string, dentistId: string, prescriptions: any[], followUp: any }) {
  const supabase = await createServiceClient()
  // 1) Create prescription alarms for patient (service-side)
  const timesByFreq = (freq?: string): string[] => {
    const f = (freq || '').toLowerCase()
    if (f.includes('thrice') || f.includes('3')) return ['09:00','14:00','21:00']
    if (f.includes('twice') || f.includes('2')) return ['09:00','21:00']
    return ['09:00']
  }
  const durationFromText = (txt?: string): { type: 'days'|'weeks'|'months'|'ongoing', value?: number } => {
    const t = (txt || '').toLowerCase()
    const n = parseInt(t.match(/\d+/)?.[0] || '0')
    if (t.includes('week')) return { type: 'weeks', value: n || 1 }
    if (t.includes('month')) return { type: 'months', value: n || 1 }
    if (t.includes('day')) return { type: 'days', value: n || 5 }
    return { type: 'days', value: n || 5 }
  }
  const prescriptions = typeof payload.prescriptions === 'string' ? JSON.parse(payload.prescriptions) : payload.prescriptions || []
  for (const med of prescriptions) {
    try {
      const nowStr = new Date().toISOString().split('T')[0]
      const d = durationFromText(med.duration)
      await supabase
        .schema('api')
        .from('prescription_alarms')
        .insert({
          patient_id: payload.patientId,
          medication_name: med.name || 'Medication',
          dosage: med.dosage || '',
          form: null,
          schedule_type: 'daily',
          frequency_per_day: timesByFreq(med.frequency).length,
          specific_times: JSON.stringify(timesByFreq(med.frequency)),
          duration_type: d.type,
          duration_value: d.value,
          start_date: nowStr,
          end_date: null,
          alarm_enabled: true,
          alarm_sound: 'default',
          snooze_enabled: true,
          snooze_duration_minutes: 10,
          instructions: med.instructions || '',
          additional_notes: ''
        })
      // We could generate instances via RPC or leave to cron; keep it simple here
    } catch (e) {
      console.warn('Failed to create alarm for medication', med?.name, e)
    }
  }

  // 2) Schedule follow-up appointments directly for the patient
  const createAppointment = async (dateTime: string, type: string, duration: number, tooth?: string) => {
    try {
      if (!dateTime) return
      const dt = new Date(dateTime)
      const dateStr = dt.toISOString().split('T')[0]
      const timeStr = dt.toISOString().split('T')[1].slice(0,5)
      await supabase
        .schema('api')
        .from('appointments')
        .insert({
          patient_id: payload.patientId,
          dentist_id: payload.dentistId,
          scheduled_date: dateStr,
          scheduled_time: timeStr,
          appointment_type: `Follow-up${tooth ? ` (Tooth ${tooth})` : ''}: ${type || 'Review'}`,
          duration_minutes: duration || 30,
          status: 'scheduled',
          notes: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
    } catch (e) {
      console.warn('Failed to create follow-up appointment', e)
    }
  }
  try {
    const fu = payload.followUp || {}
    for (const a of fu.appointments || []) {
      await createAppointment(a.scheduled_date, a.type, parseInt(a.duration || '30'))
    }
    const buckets = fu.tooth_specific_follow_ups || {}
    for (const tooth of Object.keys(buckets)) {
      for (const a of buckets[tooth]?.appointments || []) {
        await createAppointment(a.scheduled_date, a.type, parseInt(a.duration || '30'), tooth)
      }
    }
  } catch (e) {
    console.warn('Follow-up scheduling sync issue', e)
  }
}

export async function createConsultationAction(formData: ConsultationFormData) {
  try {
    const supabase = await createServiceClient()

    // Get current user (dentist)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Authentication required' }
    }

    console.log(`🏥 [CONSULTATION] Creating new consultation for patient: ${formData.patientId}`)

    // Build structured clinical data for advanced research filtering
    const clinicalData = {
      chief_complaint: formData.chiefComplaint,

      // Patient demographics and medical info
      patient_info: {
        medical_history: formData.medicalHistory || [],
        medications: formData.medicalHistory?.medications || [],
        allergies: formData.medicalHistory?.allergies || []
      },

      // Symptoms and pain assessment
      symptoms: {
        pain_level: formData.painAssessment?.painIntensity || 0,
        pain_type: formData.painAssessment?.painCharacter,
        pain_triggers: formData.painAssessment?.painTriggers || [],
        duration: formData.painAssessment?.painDuration
      },

      // Diagnosis information
      diagnosis: {
        primary: formData.diagnosis?.finalDiagnosis?.[0],
        secondary: formData.diagnosis?.finalDiagnosis?.[1],
        provisional: formData.diagnosis?.provisionalDiagnosis || [],
        differential: formData.diagnosis?.differentialDiagnosis || [],
        tooth_number: formData.diagnosis?.toothNumber
      },

      // Treatment plan
      treatment_plan: {
        recommended: formData.treatmentPlan?.primaryTreatment,
        alternative: formData.treatmentPlan?.alternativeTreatments || [],
        urgency: formData.treatmentPlan?.urgency || 'routine',
        complexity: formData.treatmentPlan?.complexity || 'simple'
      },

      // Clinical examination findings
      examination: {
        clinical_findings: formData.clinicalExamination?.intraoralFindings,
        radiographic_findings: formData.investigations?.radiographicFindings,
        extraoral_findings: formData.clinicalExamination?.extraoralFindings,
        periodontal_status: formData.clinicalExamination?.periodontalStatus
      },

      // Additional structured data for research
      prognosis: formData.prognosis,
      consultation_date: new Date().toISOString()
    }

    const consultationData: any = {
      patient_id: formData.patientId,
      dentist_id: formData.dentistId || user.id,
      consultation_date: new Date().toISOString(),
      status: formData.status || 'draft',
      chief_complaint: formData.chiefComplaint,
      pain_assessment: formData.painAssessment ? JSON.stringify(formData.painAssessment) : null,
      medical_history: formData.medicalHistory ? JSON.stringify(formData.medicalHistory) : null,
      clinical_examination: formData.clinicalExamination ? JSON.stringify(formData.clinicalExamination) : null,
      investigations: formData.investigations ? JSON.stringify(formData.investigations) : null,
      diagnosis: formData.diagnosis ? JSON.stringify(formData.diagnosis) : null,
      treatment_plan: formData.treatmentPlan ? JSON.stringify(formData.treatmentPlan) : null,
      prognosis: formData.prognosis,
      prescription_data: formData.prescriptionData ? JSON.stringify(formData.prescriptionData) : null,
      follow_up_data: formData.followUpData ? JSON.stringify(formData.followUpData) : null,
      additional_notes: formData.additionalNotes,
      voice_session_active: false,
      // ✅ NEW: Add structured clinical data for advanced research filtering
      clinical_data: clinicalData
    }

    const { data, error } = await supabase
      .schema('api')
      .from('consultations')
      .insert(consultationData)
      .select()
      .single()

    if (error) {
      console.error('❌ [CONSULTATION] Database error:', error)
      return { error: `Failed to create consultation: ${error.message}` }
    }

    console.log(`✅ [CONSULTATION] Created successfully with ID: ${data.id}`)

    // ✅ NEW: Send prescription notification if prescriptions were included
    if (formData.prescriptionData && Array.isArray(formData.prescriptionData) && formData.prescriptionData.length > 0) {
      try {
        const { createPrescriptionNotificationAction } = await import('./prescription-notifications')

        console.log(`📋 [PRESCRIPTION NOTIFICATION] Sending notification for ${formData.prescriptionData.length} prescriptions`)

        const notificationResult = await createPrescriptionNotificationAction(
          formData.patientId,
          formData.dentistId,
          data.id,
          formData.prescriptionData
        )

        if (notificationResult.success) {
          console.log(`✅ [PRESCRIPTION NOTIFICATION] Sent successfully for consultation ${data.id}`)
        } else {
          console.error(`❌ [PRESCRIPTION NOTIFICATION] Failed to send:`, notificationResult.error)
        }
      } catch (notificationError) {
        console.error('❌ [PRESCRIPTION NOTIFICATION] Error sending notification:', notificationError)
        // Don't fail the consultation creation if notification fails
      }
    }

    // Revalidate relevant pages
    revalidatePath('/dentist')
    revalidatePath('/patient')
    revalidatePath('/assistant')

    return { data, success: true }

  } catch (error) {
    console.error('❌ [CONSULTATION] Unexpected error:', error)
    return { error: 'Failed to create consultation' }
  }
}

export async function updateConsultationAction(consultationId: string, updateData: Partial<ConsultationFormData>) {
  try {
    const supabase = await createServiceClient()

    console.log(`🔄 [CONSULTATION] Updating consultation: ${consultationId}`)

    const consultationUpdate: any = {
      updated_at: new Date().toISOString()
    }

    // Map form data to database fields
    if (updateData.chiefComplaint !== undefined) consultationUpdate.chief_complaint = updateData.chiefComplaint
    if (updateData.painAssessment !== undefined) consultationUpdate.pain_assessment = JSON.stringify(updateData.painAssessment)
    if (updateData.medicalHistory !== undefined) consultationUpdate.medical_history = JSON.stringify(updateData.medicalHistory)
    if (updateData.clinicalExamination !== undefined) consultationUpdate.clinical_examination = JSON.stringify(updateData.clinicalExamination)
    if (updateData.investigations !== undefined) consultationUpdate.investigations = JSON.stringify(updateData.investigations)
    if (updateData.diagnosis !== undefined) consultationUpdate.diagnosis = JSON.stringify(updateData.diagnosis)
    if (updateData.treatmentPlan !== undefined) consultationUpdate.treatment_plan = JSON.stringify(updateData.treatmentPlan)
    if (updateData.prognosis !== undefined) consultationUpdate.prognosis = updateData.prognosis
    if (updateData.prescriptionData !== undefined) consultationUpdate.prescription_data = JSON.stringify(updateData.prescriptionData)
    if (updateData.followUpData !== undefined) consultationUpdate.follow_up_data = JSON.stringify(updateData.followUpData)
    if (updateData.additionalNotes !== undefined) consultationUpdate.additional_notes = updateData.additionalNotes
    if (updateData.status !== undefined) consultationUpdate.status = updateData.status

    const { data, error } = await supabase
      .schema('api')
      .from('consultations')
      .update(consultationUpdate)
      .eq('id', consultationId)
      .select()
      .single()

    if (error) {
      console.error('❌ [CONSULTATION] Update error:', error)
      return { error: `Failed to update consultation: ${error.message}` }
    }

    console.log(`✅ [CONSULTATION] Updated successfully`)

    // ✅ NEW: Send prescription notification if prescriptions were updated
    if (updateData.prescriptionData && Array.isArray(updateData.prescriptionData) && updateData.prescriptionData.length > 0) {
      try {
        const { createPrescriptionNotificationAction } = await import('./prescription-notifications')

        console.log(`📋 [PRESCRIPTION NOTIFICATION] Sending notification for ${updateData.prescriptionData.length} updated prescriptions`)

        const notificationResult = await createPrescriptionNotificationAction(
          data.patient_id,
          data.dentist_id,
          consultationId,
          updateData.prescriptionData
        )

        if (notificationResult.success) {
          console.log(`✅ [PRESCRIPTION NOTIFICATION] Sent successfully for updated consultation ${consultationId}`)
        } else {
          console.error(`❌ [PRESCRIPTION NOTIFICATION] Failed to send:`, notificationResult.error)
        }
      } catch (notificationError) {
        console.error('❌ [PRESCRIPTION NOTIFICATION] Error sending notification:', notificationError)
        // Don't fail the consultation update if notification fails
      }
    }

    // Revalidate relevant pages
    revalidatePath('/dentist')
    revalidatePath('/patient')
    revalidatePath('/assistant')

    return { data, success: true }

  } catch (error) {
    console.error('❌ [CONSULTATION] Update error:', error)
    return { error: 'Failed to update consultation' }
  }
}

export async function getConsultationsAction(patientId?: string, dentistId?: string) {
  try {
    // Use service client to bypass RLS policy issues
    const supabase = await createServiceClient()

    let query = supabase
      .schema('api')
      .from('consultations')
      .select('*')
      .order('consultation_date', { ascending: false })

    if (patientId) {
      query = query.eq('patient_id', patientId)
    }

    if (dentistId) {
      query = query.eq('dentist_id', dentistId)
    }

    const { data, error } = await query

    if (error) {
      console.error('❌ [CONSULTATION] Get consultations error:', error)
      return { error: `Failed to fetch consultations: ${error.message}` }
    }

    return { data: data || [], success: true }

  } catch (error) {
    console.error('❌ [CONSULTATION] Get consultations error:', error)
    return { error: 'Failed to fetch consultations' }
  }
}

export async function getConsultationByIdAction(consultationId: string) {
  try {
    // Use service client to bypass RLS policy issues
    const supabase = await createServiceClient()

    // Get consultation data
    const { data: consultation, error: consultationError } = await supabase
      .schema('api')
      .from('consultations')
      .select('*')
      .eq('id', consultationId)
      .single()

    if (consultationError) {
      console.error('❌ [CONSULTATION] Get consultation error:', consultationError)
      return { error: `Failed to fetch consultation: ${consultationError.message}` }
    }

    // Get tooth diagnoses separately
    const { data: toothDiagnoses, error: toothError } = await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .select('*')
      .eq('consultation_id', consultationId)

    if (toothError) {
      console.error('❌ [CONSULTATION] Get tooth diagnoses error:', toothError)
      // Don't fail the whole operation, just log the error
      consultation.tooth_diagnoses = []
    } else {
      consultation.tooth_diagnoses = toothDiagnoses || []
    }

    return { data: consultation, success: true }

  } catch (error) {
    console.error('❌ [CONSULTATION] Get consultation error:', error)
    return { error: 'Failed to fetch consultation' }
  }
}

// Voice Session Management
export async function startVoiceSessionAction(consultationId: string, sectionId: string) {
  try {
    const supabase = await createServiceClient()

    // Get current user (dentist)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Authentication required' }
    }

    console.log(`🎤 [VOICE] Starting voice session for consultation: ${consultationId}, section: ${sectionId}`)

    // End any existing active session for this consultation
    await supabase
      .schema('api')
      .from('voice_sessions')
      .update({
        status: 'completed',
        session_end: new Date().toISOString()
      })
      .eq('consultation_id', consultationId)
      .eq('status', 'active')

    // Create new voice session
    const sessionData = {
      consultation_id: consultationId,
      dentist_id: user.id,
      session_start: new Date().toISOString(),
      status: 'active',
      transcript: JSON.stringify([]),
      processed_data: JSON.stringify({
        section_id: sectionId,
        pain_assessment: {},
        clinical_examination: {},
        investigations: {},
        diagnosis: {},
        treatment_plan: {}
      })
    }

    const { data, error } = await supabase
      .schema('api')
      .from('voice_sessions')
      .insert(sessionData)
      .select()
      .single()

    if (error) {
      console.error('❌ [VOICE] Session creation error:', error)
      return { error: `Failed to start voice session: ${error.message}` }
    }

    // Update consultation to mark voice session as active
    await supabase
      .schema('api')
      .from('consultations')
      .update({ voice_session_active: true })
      .eq('id', consultationId)

    console.log(`✅ [VOICE] Session started with ID: ${data.id}`)

    return { data, success: true }

  } catch (error) {
    console.error('❌ [VOICE] Start session error:', error)
    return { error: 'Failed to start voice session' }
  }
}

export async function stopVoiceSessionAction(sessionId: string, transcript?: string) {
  try {
    const supabase = await createServiceClient()

    console.log(`🛑 [VOICE] Stopping voice session: ${sessionId}`)

    // Get session details
    const { data: session, error: sessionError } = await supabase
      .schema('api')
      .from('voice_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('status', 'active')
      .single()

    if (sessionError || !session) {
      return { error: 'Voice session not found or already stopped' }
    }

    const endTime = new Date()
    const startTime = new Date(session.session_start)
    const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000)

    // Update session with transcript and end time
    const updateData: any = {
      session_end: endTime.toISOString(),
      duration_seconds: durationSeconds,
      status: 'processing'
    }

    if (transcript) {
      updateData.transcript = JSON.stringify([{ text: transcript, timestamp: endTime.toISOString() }])
    }

    const { data, error } = await supabase
      .schema('api')
      .from('voice_sessions')
      .update(updateData)
      .eq('id', sessionId)
      .select()
      .single()

    if (error) {
      console.error('❌ [VOICE] Stop session error:', error)
      return { error: `Failed to stop voice session: ${error.message}` }
    }

    // Update consultation to mark voice session as inactive
    await supabase
      .schema('api')
      .from('consultations')
      .update({ voice_session_active: false })
      .eq('id', session.consultation_id)

    console.log(`✅ [VOICE] Session stopped successfully`)

    // TODO: Send to N8N for AI processing
    // This would trigger the N8N webhook with the transcript

    return { data, success: true }

  } catch (error) {
    console.error('❌ [VOICE] Stop session error:', error)
    return { error: 'Failed to stop voice session' }
  }
}

// Tooth Diagnosis Management
export async function saveToothDiagnosisAction(toothData: {
  consultationId: string
  patientId: string
  toothNumber: string
  status: string
  diagnosis?: string
  treatment?: string
  priority?: string
  colorCode?: string
  notes?: string
}) {
  try {
    const supabase = await createServiceClient()

    console.log(`🦷 [TOOTH] Saving diagnosis for tooth: ${toothData.toothNumber}`)

    const diagnosisData = {
      consultation_id: toothData.consultationId,
      patient_id: toothData.patientId,
      tooth_number: toothData.toothNumber,
      status: toothData.status,
      primary_diagnosis: toothData.diagnosis,
      recommended_treatment: toothData.treatment,
      treatment_priority: toothData.priority || 'medium',
      color_code: toothData.colorCode || '#22c55e',
      notes: toothData.notes,
      examination_date: new Date().toISOString().split('T')[0]
    }

    // Upsert tooth diagnosis (insert or update if exists)
    const { data, error } = await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .upsert(diagnosisData, {
        onConflict: 'consultation_id,tooth_number'
      })
      .select()
      .single()

    if (error) {
      console.error('❌ [TOOTH] Save diagnosis error:', error)
      return { error: `Failed to save tooth diagnosis: ${error.message}` }
    }

    console.log(`✅ [TOOTH] Diagnosis saved successfully`)

    return { data, success: true }

  } catch (error) {
    console.error('❌ [TOOTH] Save diagnosis error:', error)
    return { error: 'Failed to save tooth diagnosis' }
  }
}

export async function getToothDiagnosesAction(consultationId: string) {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .select('*')
      .eq('consultation_id', consultationId)
      .order('tooth_number')

    if (error) {
      console.error('❌ [TOOTH] Get diagnoses error:', error)
      return { error: `Failed to fetch tooth diagnoses: ${error.message}` }
    }

    return { data: data || [], success: true }

  } catch (error) {
    console.error('❌ [TOOTH] Get diagnoses error:', error)
    return { error: 'Failed to fetch tooth diagnoses' }
  }
}

// Comprehensive consultation save action for enhanced new consultation
export async function saveCompleteConsultationAction(formData: {
  patientId: string
  dentistId?: string
  consultationData: any // All the consultation form data
  toothData: { [toothNumber: string]: any } // Tooth-specific data from the chart
  status?: 'draft' | 'completed' | 'archived'
}) {
  try {
    // Try regular client first to get user, fallback to service client if needed
    let dentistId = formData.dentistId
    
    if (!dentistId) {
      // Try to get current user from regular client
      const regularClient = await createClient()
      const { data: { user } } = await regularClient.auth.getUser()
      
      if (user) {
        dentistId = user.id
      } else {
        return { error: 'Authentication required - please log in' }
      }
    }

    const supabase = await createServiceClient()

    console.log(`🏥 [COMPLETE CONSULTATION] Saving consultation for patient: ${formData.patientId}`)
    console.log(`🦷 [COMPLETE CONSULTATION] Tooth data for ${Object.keys(formData.toothData).length} teeth`)

    // Step 1: Create or update consultation record

    // Build structured clinical data for advanced research filtering
    const clinicalData = {
      chief_complaint: formData.consultationData.chiefComplaint,

      // Patient demographics and medical info
      patient_info: {
        medical_history: formData.consultationData.medicalHistory || [],
        medications: formData.consultationData.currentMedications || [],
        allergies: formData.consultationData.allergies || []
      },

      // Symptoms and pain assessment
      symptoms: {
        pain_level: formData.consultationData.painIntensity || 0,
        pain_type: formData.consultationData.painCharacter,
        pain_triggers: formData.consultationData.painTriggers || [],
        duration: formData.consultationData.painDuration
      },

      // Diagnosis information
      diagnosis: {
        primary: formData.consultationData.finalDiagnosis?.[0],
        secondary: formData.consultationData.finalDiagnosis?.[1],
        provisional: formData.consultationData.provisionalDiagnosis || [],
        differential: formData.consultationData.differentialDiagnosis || []
      },

      // Treatment plan
      treatment_plan: {
        recommended: formData.consultationData.treatmentPlan?.[0],
        alternative: formData.consultationData.treatmentPlan?.slice(1) || [],
        urgency: 'routine', // Could be extracted from data
        complexity: 'moderate' // Could be extracted from data
      },

      // Clinical examination findings
      examination: {
        clinical_findings: formData.consultationData.intraoralFindings,
        radiographic_findings: formData.consultationData.radiographicFindings,
        extraoral_findings: formData.consultationData.extraoralFindings,
        periodontal_status: formData.consultationData.periodontalStatus
      },

      // Additional structured data for research
      prognosis: formData.consultationData.prognosis,
      consultation_date: new Date().toISOString()
    }

    const consultationRecord = {
      patient_id: formData.patientId,
      dentist_id: dentistId,
      consultation_date: new Date().toISOString(),
      status: formData.status || 'completed',
      chief_complaint: formData.consultationData.chiefComplaint,
      pain_assessment: JSON.stringify({
        intensity: formData.consultationData.painIntensity,
        location: formData.consultationData.painLocation,
        duration: formData.consultationData.painDuration,
        character: formData.consultationData.painCharacter,
        triggers: formData.consultationData.painTriggers,
        relief: formData.consultationData.painRelief
      }),
      medical_history: JSON.stringify({
        conditions: formData.consultationData.medicalHistory,
        medications: formData.consultationData.currentMedications,
        allergies: formData.consultationData.allergies,
        previous_treatments: formData.consultationData.previousDentalTreatments
      }),
      clinical_examination: JSON.stringify({
        extraoral: formData.consultationData.extraoralFindings,
        intraoral: formData.consultationData.intraoralFindings,
        periodontal: formData.consultationData.periodontalStatus,
        occlusion: formData.consultationData.occlusionNotes
      }),
      investigations: JSON.stringify({
        radiographic: formData.consultationData.radiographicFindings,
        vitality: formData.consultationData.vitalityTests,
        percussion: formData.consultationData.percussionTests,
        palpation: formData.consultationData.palpationFindings
      }),
      diagnosis: JSON.stringify({
        provisional: formData.consultationData.provisionalDiagnosis,
        differential: formData.consultationData.differentialDiagnosis,
        final: formData.consultationData.finalDiagnosis
      }),
      treatment_plan: JSON.stringify({
        plan: formData.consultationData.treatmentPlan,
        prognosis: formData.consultationData.prognosis
      }),
      prescription_data: JSON.stringify(formData.consultationData.prescriptions || []),
      follow_up_data: JSON.stringify(formData.consultationData.followUpPlans ?? {}),
      additional_notes: formData.consultationData.additionalNotes,
      voice_session_active: false,
      // ✅ NEW: Add structured clinical data for advanced research filtering
      clinical_data: clinicalData
    }

    const { data: consultationResult, error: consultationError } = await supabase
      .schema('api')
      .from('consultations')
      .insert(consultationRecord)
      .select()
      .single()

    if (consultationError) {
      console.error('❌ [COMPLETE CONSULTATION] Consultation creation error:', consultationError)
      return { error: `Failed to create consultation: ${consultationError.message}` }
    }

    console.log(`✅ [COMPLETE CONSULTATION] Consultation created with ID: ${consultationResult.id}`)

    // Step 2: Save tooth diagnoses
    const toothRecords = []
    for (const [toothNumber, toothInfo] of Object.entries(formData.toothData)) {
      if (toothInfo && (toothInfo.selectedDiagnoses?.length > 0 || toothInfo.selectedTreatments?.length > 0)) {
        const toothRecord = {
          consultation_id: consultationResult.id,
          patient_id: formData.patientId,
          tooth_number: toothNumber,
          status: toothInfo.currentStatus || 'healthy',
          primary_diagnosis: toothInfo.selectedDiagnoses?.join(', ') || null,
          diagnosis_details: toothInfo.diagnosisDetails || null,
          symptoms: null, // Skip symptoms for now due to database type mismatch
          recommended_treatment: toothInfo.selectedTreatments?.join(', ') || null,
          treatment_priority: toothInfo.priority || 'medium',
          treatment_details: toothInfo.treatmentDetails || null,
          estimated_duration: parseInt(toothInfo.duration) || null,
          estimated_cost: toothInfo.estimatedCost || null,
          scheduled_date: toothInfo.scheduledDate || null,
          follow_up_required: toothInfo.followUpRequired || false,
          examination_date: toothInfo.examinationDate || new Date().toISOString().split('T')[0],
          notes: toothInfo.treatmentNotes || toothInfo.diagnosticNotes || null,
          color_code: toothInfo.currentStatus === 'caries' ? '#ef4444' :
                     toothInfo.currentStatus === 'filled' ? '#3b82f6' :
                     toothInfo.currentStatus === 'missing' ? '#6b7280' :
                     '#22c55e' // healthy default
        }
        toothRecords.push(toothRecord)
      }
    }

    // Batch insert tooth diagnoses
    if (toothRecords.length > 0) {
      const { data: toothResult, error: toothError } = await supabase
        .schema('api')
        .from('tooth_diagnoses')
        .insert(toothRecords)
        .select()

      if (toothError) {
        console.error('❌ [COMPLETE CONSULTATION] Tooth diagnoses error:', toothError)
        // Don't fail the whole operation, just log the error
        console.log('⚠️ [COMPLETE CONSULTATION] Continuing despite tooth diagnoses error')
      } else {
        console.log(`✅ [COMPLETE CONSULTATION] Saved ${toothResult.length} tooth diagnoses`)
      }
    }

    // After saving consultation, if completed, sync patient side objects
    try {
      if ((formData.status || 'completed') === 'completed') {
        await syncPatientSideFromConsultationInternal({
          patientId: formData.patientId,
          dentistId: dentistId!,
          prescriptions: formData.consultationData.prescriptions || [],
          followUp: formData.consultationData.followUpPlans || {}
        })
      }
    } catch (e) {
      console.warn('Patient-side sync warning:', e)
    }

    // Revalidate relevant pages
    revalidatePath('/dentist')
    revalidatePath('/patient')
    revalidatePath('/assistant')

    return {
      data: {
        consultation: consultationResult,
        toothCount: toothRecords.length
      },
      success: true
    }

  } catch (error) {
    console.error('❌ [COMPLETE CONSULTATION] Unexpected error:', error)
    return { error: 'Failed to save consultation' }
  }
}

// Save/merge a single section of the consultation into clinical_data (JSONB)
// This creates a draft consultation if one doesn't exist and returns its ID
export async function saveConsultationSectionAction(payload: {
  patientId: string
  sectionId: string
  sectionData: any
  consultationId?: string
  dentistId?: string
}): Promise<{ success: boolean; consultationId?: string; error?: string }> {
  try {
    const supabase = await createServiceClient()

    // Determine dentist
    let dentistId = payload.dentistId
    if (!dentistId) {
      // Use a regular client bound to request cookies to read the authenticated user
      const regularClient = await createClient()
      const { data: { user } } = await regularClient.auth.getUser()
      if (!user) return { success: false, error: 'Authentication required' }
      dentistId = user.id
    }

    // Helper: map a tab section payload to the canonical clinical_data shape
    const mapSectionToClinicalData = (sectionId: string, data: any, existing: any = {}) => {
      const cd = { ...(existing || {}) }
      switch (sectionId) {
        case 'chief-complaint': {
          cd.chief_complaint = data.primary_complaint || cd.chief_complaint || ''
          cd.symptoms = {
            ...(cd.symptoms || {}),
            pain_level: data.severity_scale ?? data.pain_scale ?? cd.symptoms?.pain_level ?? 0,
            pain_type: data.onset_type ?? cd.symptoms?.pain_type ?? '',
            pain_triggers: data.triggers || data.associated_symptoms || cd.symptoms?.pain_triggers || [],
            duration: data.onset_duration ?? cd.symptoms?.duration ?? '',
            location: data.location_detail ?? cd.symptoms?.location ?? ''
          }
          break
        }
        case 'hopi': {
          cd.hopi = {
            ...(cd.hopi || {}),
            pain_characteristics: data.pain_characteristics || cd.hopi?.pain_characteristics || {},
            aggravating_factors: data.aggravating_factors || cd.hopi?.aggravating_factors || [],
            relieving_factors: data.relieving_factors || cd.hopi?.relieving_factors || [],
            previous_episodes: data.previous_episodes || cd.hopi?.previous_episodes || ''
          }
          // Also reflect key values into symptoms for simpler queries
          cd.symptoms = {
            ...(cd.symptoms || {}),
            pain_level: data.pain_characteristics?.intensity ?? cd.symptoms?.pain_level ?? 0,
            pain_type: data.pain_characteristics?.quality ?? cd.symptoms?.pain_type ?? '',
            duration: data.pain_characteristics?.duration ?? cd.symptoms?.duration ?? ''
          }
          break
        }
        case 'medical-history': {
          cd.patient_info = {
            ...(cd.patient_info || {}),
            medical_history: data.current_conditions || cd.patient_info?.medical_history || [],
            medications: data.current_medications || cd.patient_info?.medications || [],
            allergies: data.allergies || cd.patient_info?.allergies || []
          }
          break
        }
        case 'personal-history': {
          cd.personal_history = {
            ...(cd.personal_history || {}),
            ...data
          }
          break
        }
        case 'clinical-examination': {
          const extraoral = data.extraoral_findings ? Object.values(data.extraoral_findings).filter(Boolean).join('; ') : cd.examination?.extraoral_findings || ''
          const intraoral = data.intraoral_findings ? Object.values(data.intraoral_findings).filter(Boolean).join('; ') : cd.examination?.intraoral_findings || ''
          cd.examination = {
            ...(cd.examination || {}),
            extraoral_findings: extraoral,
            intraoral_findings: intraoral,
            periodontal_status: data.intraoral_findings?.periodontal_status || cd.examination?.periodontal_status || ''
          }
          break
        }
        case 'investigations': {
          cd.examination = {
            ...(cd.examination || {}),
            radiographic_findings: data.radiographic?.findings || cd.examination?.radiographic_findings || ''
          }
          cd.investigations = {
            ...(cd.investigations || {}),
            ...data
          }
          break
        }
        case 'clinical-diagnosis': {
          const primary = (data.final_diagnoses && data.final_diagnoses[0]) || cd.diagnosis?.primary || ''
          cd.diagnosis = {
            primary,
            secondary: (data.final_diagnoses && data.final_diagnoses[1]) || cd.diagnosis?.secondary || '',
            provisional: data.provisional_diagnoses || cd.diagnosis?.provisional || [],
            differential: data.differential_diagnoses || cd.diagnosis?.differential || []
          }
          break
        }
        case 'treatment-plan': {
          const phases = data.treatment_phases || []
          cd.treatment_plan = {
            recommended: phases[0] || cd.treatment_plan?.recommended || '',
            alternative: phases.slice(1) || cd.treatment_plan?.alternative || [],
            urgency: cd.treatment_plan?.urgency || 'routine',
            complexity: cd.treatment_plan?.complexity || 'moderate'
          }
          cd.prognosis = data.overall_prognosis ?? cd.prognosis ?? ''
          break
        }
        case 'follow-up': {
          cd.follow_up = {
            ...(cd.follow_up || {}),
            ...data
          }
          break
        }
        default:
          break
      }
      // Always stamp last_updated
      cd.consultation_date = cd.consultation_date || new Date().toISOString()
      cd.last_updated_at = new Date().toISOString()
      return cd
    }

    // 1) Find existing draft or the provided consultation
    let targetConsultationId = payload.consultationId || null
    let existingClinical: any = {}

    if (targetConsultationId) {
      const { data: existing, error } = await supabase
        .schema('api')
        .from('consultations')
        .select('id, clinical_data')
        .eq('id', targetConsultationId)
        .single()
      if (!error && existing) {
        existingClinical = existing.clinical_data || {}
      } else {
        targetConsultationId = null // fallback to draft creation
      }
    }

    if (!targetConsultationId) {
      // Look for latest draft for this patient & dentist
      const { data: drafts } = await supabase
        .schema('api')
        .from('consultations')
        .select('id, clinical_data')
        .eq('patient_id', payload.patientId)
        .eq('dentist_id', dentistId)
        .eq('status', 'draft')
        .order('updated_at', { ascending: false })
        .limit(1)
      if (drafts && drafts.length > 0) {
        targetConsultationId = drafts[0].id
        existingClinical = drafts[0].clinical_data || {}
      }
    }

    // 2) If still none, create a new draft
    if (!targetConsultationId) {
      const insertData: any = {
        patient_id: payload.patientId,
        dentist_id: dentistId,
        consultation_date: new Date().toISOString(),
        status: 'draft',
        chief_complaint: null,
        clinical_data: { consultation_date: new Date().toISOString() }
      }
      const { data: created, error: insertError } = await supabase
        .schema('api')
        .from('consultations')
        .insert(insertData)
        .select('id, clinical_data')
        .single()
      if (insertError) {
        console.error('❌ [SECTION SAVE] Draft creation failed:', insertError)
        return { success: false, error: 'Failed to create draft consultation' }
      }
      targetConsultationId = created.id
      existingClinical = created.clinical_data || {}
    }

    // 3) Merge incoming section into clinical_data
    const mergedClinical = mapSectionToClinicalData(payload.sectionId, payload.sectionData, existingClinical)

    const updatePayload: any = {
      clinical_data: mergedClinical,
      updated_at: new Date().toISOString()
    }
    // Convenience: keep chief_complaint in top-level for quick lists
    if (mergedClinical.chief_complaint) updatePayload.chief_complaint = mergedClinical.chief_complaint

    const { error: updateError } = await supabase
      .schema('api')
      .from('consultations')
      .update(updatePayload)
      .eq('id', targetConsultationId)

    if (updateError) {
      console.error('❌ [SECTION SAVE] Update failed:', updateError)
      return { success: false, error: 'Failed to save section' }
    }

    return { success: true, consultationId: targetConsultationId }
  } catch (error) {
    console.error('❌ [SECTION SAVE] Unexpected error:', error)
    return { success: false, error: 'Unexpected error saving section' }
  }
}

// Finalize an existing draft consultation by updating all fields and status, and saving tooth data
import { updateAppointmentStatus } from '@/lib/services/appointments'

export async function finalizeConsultationFromDraftAction(payload: {
  consultationId?: string
  patientId: string
  dentistId?: string
  consultationData: any
  toothData: { [toothNumber: string]: any }
  status: 'draft' | 'completed' | 'archived'
  appointmentId?: string
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const supabase = await createServiceClient()

    // Determine dentist
    let dentistId = payload.dentistId
    if (!dentistId) {
      // Use a regular client bound to request cookies to read the authenticated user
      const regularClient = await createClient()
      const { data: { user } } = await regularClient.auth.getUser()
      if (!user) return { success: false, error: 'Authentication required' }
      dentistId = user.id
    }

    // Build canonical clinical_data from full consultationData
    const clinicalData = {
      chief_complaint: payload.consultationData.chiefComplaint,
      patient_info: {
        medical_history: payload.consultationData.medicalHistory || [],
        medications: payload.consultationData.currentMedications || [],
        allergies: payload.consultationData.allergies || []
      },
      symptoms: {
        pain_level: payload.consultationData.painIntensity || 0,
        pain_type: payload.consultationData.painCharacter || '',
        pain_triggers: payload.consultationData.painTriggers || [],
        duration: payload.consultationData.painDuration || '',
        location: payload.consultationData.painLocation || ''
      },
      diagnosis: {
        primary: payload.consultationData.finalDiagnosis?.[0] || '',
        secondary: payload.consultationData.finalDiagnosis?.[1] || '',
        provisional: payload.consultationData.provisionalDiagnosis || [],
        differential: payload.consultationData.differentialDiagnosis || []
      },
      treatment_plan: {
        recommended: payload.consultationData.treatmentPlan?.[0] || '',
        alternative: (payload.consultationData.treatmentPlan || []).slice(1),
        urgency: 'routine',
        complexity: 'moderate'
      },
      examination: {
        clinical_findings: payload.consultationData.intraoralFindings || '',
        radiographic_findings: payload.consultationData.radiographicFindings || '',
        extraoral_findings: payload.consultationData.extraoralFindings || '',
        periodontal_status: payload.consultationData.periodontalStatus || ''
      },
      prognosis: payload.consultationData.prognosis || '',
      consultation_date: new Date().toISOString(),
      last_updated_at: new Date().toISOString()
    }

    const commonFields = {
      patient_id: payload.patientId,
      dentist_id: dentistId,
      consultation_date: new Date().toISOString(),
      status: payload.status,
      chief_complaint: payload.consultationData.chiefComplaint,
      pain_assessment: JSON.stringify({
        intensity: payload.consultationData.painIntensity,
        location: payload.consultationData.painLocation,
        duration: payload.consultationData.painDuration,
        character: payload.consultationData.painCharacter,
        triggers: payload.consultationData.painTriggers,
        relief: payload.consultationData.painRelief
      }),
      medical_history: JSON.stringify({
        conditions: payload.consultationData.medicalHistory,
        medications: payload.consultationData.currentMedications,
        allergies: payload.consultationData.allergies,
        previous_treatments: payload.consultationData.previousDentalTreatments
      }),
      clinical_examination: JSON.stringify({
        extraoral: payload.consultationData.extraoralFindings,
        intraoral: payload.consultationData.intraoralFindings,
        periodontal: payload.consultationData.periodontalStatus,
        occlusion: payload.consultationData.occlusionNotes
      }),
      investigations: JSON.stringify({
        radiographic: payload.consultationData.radiographicFindings,
        vitality: payload.consultationData.vitalityTests,
        percussion: payload.consultationData.percussionTests,
        palpation: payload.consultationData.palpationFindings
      }),
      diagnosis: JSON.stringify({
        provisional: payload.consultationData.provisionalDiagnosis,
        differential: payload.consultationData.differentialDiagnosis,
        final: payload.consultationData.finalDiagnosis
      }),
      treatment_plan: JSON.stringify({
        plan: payload.consultationData.treatmentPlan,
        prognosis: payload.consultationData.prognosis
      }),
      prescription_data: JSON.stringify(payload.consultationData.prescriptions || []),
      follow_up_data: JSON.stringify(payload.consultationData.followUpPlans ?? {}),
      additional_notes: payload.consultationData.additionalNotes,
      voice_session_active: false,
      clinical_data: clinicalData,
      updated_at: new Date().toISOString()
    }

    let consultationId = payload.consultationId

    if (!consultationId) {
      // No draft id provided, insert a new record
      const { data: inserted, error: insertError } = await supabase
        .schema('api')
        .from('consultations')
        .insert(commonFields)
        .select('id')
        .single()
      if (insertError) {
        console.error('❌ [FINALIZE] Insert failed:', insertError)
        return { success: false, error: 'Failed to create consultation' }
      }
      consultationId = inserted.id
    } else {
      // Update existing draft
      const { error: updateError } = await supabase
        .schema('api')
        .from('consultations')
        .update(commonFields)
        .eq('id', consultationId)
      if (updateError) {
        console.error('❌ [FINALIZE] Update failed:', updateError)
        return { success: false, error: 'Failed to update consultation' }
      }
    }

    // Upsert tooth diagnoses for this consultation
    // Delete existing first to keep it simple
    await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .delete()
      .eq('consultation_id', consultationId)

    const toothRecords = [] as any[]
    for (const [toothNumber, toothInfo] of Object.entries(payload.toothData || {})) {
      if (toothInfo && ((toothInfo as any).selectedDiagnoses?.length > 0 || (toothInfo as any).selectedTreatments?.length > 0)) {
        toothRecords.push({
          consultation_id: consultationId,
          patient_id: payload.patientId,
          tooth_number: toothNumber,
          status: (toothInfo as any).currentStatus || 'healthy',
          primary_diagnosis: (toothInfo as any).selectedDiagnoses?.join(', ') || null,
          diagnosis_details: (toothInfo as any).diagnosisDetails || null,
          symptoms: null,
          recommended_treatment: (toothInfo as any).selectedTreatments?.join(', ') || null,
          treatment_priority: (toothInfo as any).priority || 'medium',
          treatment_details: (toothInfo as any).treatmentDetails || null,
          estimated_duration: parseInt((toothInfo as any).duration) || null,
          estimated_cost: (toothInfo as any).estimatedCost || null,
          scheduled_date: (toothInfo as any).scheduledDate || null,
          follow_up_required: (toothInfo as any).followUpRequired || false,
          examination_date: (toothInfo as any).examinationDate || new Date().toISOString().split('T')[0],
          notes: (toothInfo as any).treatmentNotes || (toothInfo as any).diagnosticNotes || null,
          color_code: (toothInfo as any).currentStatus === 'caries' ? '#ef4444' :
                     (toothInfo as any).currentStatus === 'filled' ? '#3b82f6' :
                     (toothInfo as any).currentStatus === 'missing' ? '#6b7280' :
                     '#22c55e'
        })
      }
    }

    if (toothRecords.length > 0) {
      const { error: toothError } = await supabase
        .schema('api')
        .from('tooth_diagnoses')
        .insert(toothRecords)
      if (toothError) {
        console.error('❌ [FINALIZE] Tooth insert failed:', toothError)
        // continue without failing
      }
    }

    // After finalize, if completed, sync patient side prescriptions and follow-ups
    try {
      if (payload.status === 'completed') {
        await syncPatientSideFromConsultationInternal({
          patientId: payload.patientId,
          dentistId: dentistId!,
          prescriptions: payload.consultationData.prescriptions || [],
          followUp: payload.consultationData.followUpPlans || {}
        })
      }
    } catch (e) {
      console.warn('Patient-side sync warning:', e)
    }

    // If this finalize marks consultation completed and we have an appointment context, complete it
    try {
      if (payload.status === 'completed' && payload.appointmentId) {
        await updateAppointmentStatus(payload.appointmentId, 'completed', dentistId!)
      }
    } catch (e) {
      console.warn('[CONSULTATION] Failed to auto-complete appointment:', e)
    }

    // Revalidate
    revalidatePath('/dentist')
    revalidatePath('/patient')
    revalidatePath('/assistant')

    return { success: true, data: { id: consultationId } }
  } catch (error) {
    console.error('❌ [FINALIZE] Unexpected error:', error)
    return { success: false, error: 'Unexpected error finalizing consultation' }
  }
}

// Load consultation data for enhanced consultation component
export async function loadPatientConsultationAction(patientId: string, consultationId?: string) {
  try {
    const supabase = await createClient()

    console.log(`🔍 [LOAD CONSULTATION] Loading consultation data for patient: ${patientId}`)

    let consultationData

    if (consultationId) {
      // Load specific consultation
      const result = await getConsultationByIdAction(consultationId)
      if (result.error) return result
      consultationData = result.data
    } else {
      // Load latest consultation for patient
      const result = await getConsultationsAction(patientId)
      if (result.error) return result

      const consultations = result.data
      if (!consultations || consultations.length === 0) {
        return { data: null, success: true } // No previous consultations
      }

      consultationData = consultations[0] // Most recent
    }

    console.log(`✅ [LOAD CONSULTATION] Found consultation: ${consultationData.id}`)

    // Convert database format back to enhanced consultation format
      const formattedConsultationData = {
      patientId: consultationData.patient_id,
      chiefComplaint: consultationData.chief_complaint || '',
      painLocation: consultationData.pain_assessment?.location || '',
      painIntensity: consultationData.pain_assessment?.intensity || 0,
      painDuration: consultationData.pain_assessment?.duration || '',
      painCharacter: consultationData.pain_assessment?.character || '',
      painTriggers: consultationData.pain_assessment?.triggers || [],
      painRelief: consultationData.pain_assessment?.relief || [],

      medicalHistory: consultationData.medical_history?.conditions || [],
      currentMedications: consultationData.medical_history?.medications || [],
      allergies: consultationData.medical_history?.allergies || [],
      previousDentalTreatments: consultationData.medical_history?.previous_treatments || [],

      extraoralFindings: consultationData.clinical_examination?.extraoral || '',
      intraoralFindings: consultationData.clinical_examination?.intraoral || '',
      periodontalStatus: consultationData.clinical_examination?.periodontal || '',
      occlusionNotes: consultationData.clinical_examination?.occlusion || '',

      radiographicFindings: consultationData.investigations?.radiographic || '',
      vitalityTests: consultationData.investigations?.vitality || '',
      percussionTests: consultationData.investigations?.percussion || '',
      palpationFindings: consultationData.investigations?.palpation || '',

      provisionalDiagnosis: consultationData.diagnosis?.provisional || [],
      differentialDiagnosis: consultationData.diagnosis?.differential || [],
      finalDiagnosis: consultationData.diagnosis?.final || [],

      treatmentPlan: consultationData.treatment_plan?.plan || [],
      prognosis: consultationData.treatment_plan?.prognosis || '',

      prescriptions: consultationData.prescription_data || [],
      followUpPlans: consultationData.follow_up_data || {},
      additionalNotes: consultationData.additional_notes || ''
    }

    // Convert tooth diagnoses to toothData format
    const toothData: { [key: string]: any } = {}

    if (consultationData.tooth_diagnoses && consultationData.tooth_diagnoses.length > 0) {
      for (const toothDiagnosis of consultationData.tooth_diagnoses) {
        const toothNumber = toothDiagnosis.tooth_number

        toothData[toothNumber] = {
          currentStatus: toothDiagnosis.status || 'healthy',
          selectedDiagnoses: toothDiagnosis.primary_diagnosis ? toothDiagnosis.primary_diagnosis.split(', ') : [],
          selectedTreatments: toothDiagnosis.recommended_treatment ? toothDiagnosis.recommended_treatment.split(', ') : [],
          diagnosisDetails: toothDiagnosis.diagnosis_details,
          symptoms: toothDiagnosis.symptoms ? toothDiagnosis.symptoms.split(', ').filter(s => s.trim()) : [],
          treatmentDetails: toothDiagnosis.treatment_details,
          priority: toothDiagnosis.treatment_priority || 'medium',
          duration: toothDiagnosis.estimated_duration?.toString() || '',
          estimatedCost: toothDiagnosis.estimated_cost,
          scheduledDate: toothDiagnosis.scheduled_date,
          followUpRequired: toothDiagnosis.follow_up_required || false,
          examinationDate: toothDiagnosis.examination_date,
          treatmentNotes: toothDiagnosis.notes,
          diagnosticNotes: toothDiagnosis.notes
        }
      }
    }

    console.log(`✅ [LOAD CONSULTATION] Loaded ${Object.keys(toothData).length} tooth records`)

    return {
      data: {
        consultation: consultationData,
        consultationData: formattedConsultationData,
        toothData: toothData
      },
      success: true
    }

  } catch (error) {
    console.error('❌ [LOAD CONSULTATION] Unexpected error:', error)
    return { error: 'Failed to load consultation data' }
  }
}

// Create appointment request from consultation
export async function createAppointmentRequestFromConsultationAction(formData: {
  consultationId: string
  patientId: string
  dentistId?: string
  appointmentType: string
  reasonForVisit: string
  urgencyLevel: 'routine' | 'urgent' | 'emergency'
  delegateToAssistant?: boolean
  requestedDate?: string
  requestedTime?: string
  additionalNotes?: string
}) {
  try {
    console.log('🔍 [DEBUG] Appointment request input data:', {
      consultationId: formData.consultationId,
      patientId: formData.patientId,
      appointmentType: formData.appointmentType,
      urgencyLevel: formData.urgencyLevel,
      delegateToAssistant: formData.delegateToAssistant
    })

    // Get current user (dentist) if not provided
    let dentistId = formData.dentistId
    if (!dentistId) {
      // Try to get current user from regular client first
      const regularClient = await createClient()
      const { data: { user }, error: userError } = await regularClient.auth.getUser()

      if (user) {
        dentistId = user.id
        console.log(`🔐 [AUTH] Using authenticated user: ${dentistId}`)
      } else {
        // Fallback: Use the first available dentist ID (server actions don't have auth context)
        console.log('🔍 [FALLBACK] No auth context, using fallback dentist lookup')
        const supabase = await createServiceClient()
        const { data: dentists, error: dentistError } = await supabase
          .schema('api')
          .from('dentists')
          .select('id')
          .limit(1)

        if (dentistError || !dentists || dentists.length === 0) {
          console.error('❌ [FALLBACK] No dentists found:', dentistError?.message)
          return { error: 'Unable to identify dentist. Please contact support.' }
        }

        dentistId = dentists[0].id
        console.log(`🔄 [FALLBACK] Using fallback dentist: ${dentistId}`)
      }
    }

    const supabase = await createServiceClient()

    console.log(`🏥 [CONSULTATION TO APPOINTMENT] Creating appointment request from consultation: ${formData.consultationId}`)

    // Create appointment request
    const appointmentRequestData = {
      patient_id: formData.patientId,
      appointment_type: formData.appointmentType,
      preferred_date: formData.requestedDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Default to 1 week from now
      preferred_time: formData.requestedTime || '09:00:00',
      reason_for_visit: formData.reasonForVisit,
      pain_level: formData.urgencyLevel === 'emergency' ? 8 : formData.urgencyLevel === 'urgent' ? 5 : 2,
      additional_notes: formData.additionalNotes || '',
      status: 'pending',
      notification_sent: false,
      assigned_to: null // Always null - assistants can pick up delegated tasks, dentists handle direct scheduling
    }

    const { data: appointmentRequest, error: requestError } = await supabase
      .schema('api')
      .from('appointment_requests')
      .insert([appointmentRequestData])
      .select()
      .single()

    if (requestError) {
      console.error('❌ [APPOINTMENT REQUEST] Database error:', requestError)
      console.error('❌ [APPOINTMENT REQUEST] Failed data:', appointmentRequestData)
      return {
        error: `Failed to create appointment request: ${requestError.message}`,
        details: requestError
      }
    }

    // Create notification for assigned person (dentist or any assistant if delegated)
    if (formData.delegateToAssistant) {
      // Create task for assistants
      const { data: assistants } = await supabase
        .schema('api')
        .from('assistants')
        .select('id')
        .limit(1)

      if (assistants && assistants.length > 0) {
        // Create task for first available assistant (could be enhanced to smart assignment)
        await supabase
          .schema('api')
          .from('tasks')
          .insert([{
            title: `Schedule Appointment: ${formData.appointmentType}`,
            description: `Patient needs follow-up appointment. Consultation ID: ${formData.consultationId}. Reason: ${formData.reasonForVisit}`,
            priority: formData.urgencyLevel === 'emergency' ? 'high' : formData.urgencyLevel === 'urgent' ? 'medium' : 'low',
            assigned_to: assistants[0].id,
            category: 'appointment_scheduling',
            related_patient_id: formData.patientId,
            related_appointment_request_id: appointmentRequest.id,
            status: 'pending',
            created_by: dentistId,
            created_at: new Date().toISOString()
          }])

        // Create notification for assistant
        await supabase
          .schema('api')
          .from('notifications')
          .insert([{
            user_id: assistants[0].id,
            type: 'task_assigned',
            title: 'New Appointment Scheduling Task',
            message: `Dr. has requested you to schedule a ${formData.appointmentType} appointment for a patient following consultation.`,
            related_id: appointmentRequest.id,
            read: false,
            created_at: new Date().toISOString()
          }])
      }
    } else {
      // Create notification for dentist to handle directly
      await supabase
        .schema('api')
        .from('notifications')
        .insert([{
          user_id: dentistId,
          type: 'appointment_request',
          title: 'Follow-up Appointment Request Created',
          message: `Appointment request created from consultation for ${formData.appointmentType}.`,
          related_id: appointmentRequest.id,
          read: false,
          created_at: new Date().toISOString()
        }])
    }

    // Update consultation with appointment request link
    await supabase
      .schema('api')
      .from('consultations')
      .update({
        follow_up_appointment_id: appointmentRequest.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', formData.consultationId)

    // Revalidate relevant pages
    revalidatePath('/dentist')
    revalidatePath('/assistant')
    revalidatePath('/assistant/verify')

    console.log(`✅ [CONSULTATION TO APPOINTMENT] Successfully created appointment request: ${appointmentRequest.id}`)

    return {
      success: true,
      data: appointmentRequest,
      message: formData.delegateToAssistant ?
        'Appointment request created and assigned to assistant' :
        'Appointment request created for your review'
    }

  } catch (error) {
    console.error('❌ [CONSULTATION TO APPOINTMENT] Unexpected error:', error)
    return {
      error: error instanceof Error ? error.message : 'Failed to create appointment request'
    }
  }
}