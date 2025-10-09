'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { parseAppointmentRequest, generateAppointmentConfirmation, ParsedAppointmentRequest } from '@/lib/services/ai-appointment-parser'
import { createContextualAppointment } from '@/lib/actions/contextual-appointments'

export interface AIAppointmentResult {
  success: boolean
  message?: string
  error?: string
  appointmentId?: string
  parsedRequest?: ParsedAppointmentRequest
  confidence?: number
}

/**
 * Create an appointment from natural language input using AI
 * 
 * This action:
 * 1. Parses natural language using AI
 * 2. Finds the patient in the database
 * 3. Gets the dentist ID (current user or default)
 * 4. Finds related consultation and treatment context
 * 5. Creates contextual appointment with proper linkage
 * 
 * @param naturalLanguageInput - e.g., "Schedule RCT for John Doe on tooth 34 tomorrow at 2 PM"
 * @param dentistId - The dentist who will perform the treatment (required)
 * @returns Result with success status and appointment details
 */
export async function scheduleAppointmentWithAI(
  naturalLanguageInput: string,
  dentistId: string
): Promise<AIAppointmentResult> {
  
  try {
    console.log('🤖 [AI SCHEDULER] Starting AI appointment scheduling...')
    console.log('📝 [AI SCHEDULER] Input:', naturalLanguageInput)
    console.log('👨‍⚕️ [AI SCHEDULER] Dentist ID:', dentistId)

    // Step 0: Get available patients and pending requests for context
    const supabase = await createServiceClient()
    
    // Get recent patients
    const { data: recentPatients, error: patientsError } = await supabase
      .schema('api')
      .from('patients')
      .select('id, first_name, last_name')
      .order('created_at', { ascending: false })  // Use created_at instead of updated_at
      .limit(50) // Get recent patients for context
    
    if (patientsError) {
      console.error('❌ [AI SCHEDULER] Error loading patients:', patientsError)
    }
    
    console.log('👥 [AI SCHEDULER] Loaded', recentPatients?.length || 0, 'patients for context')
    
    // Get pending appointment requests for contextual references
    const { data: pendingRequests, error: requestsError } = await supabase
      .schema('api')
      .from('appointment_requests')
      .select('id, patient_id')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50)
    
    if (requestsError) {
      console.error('❌ [AI SCHEDULER] Error loading pending requests:', requestsError)
    }
    
    // Manually fetch patient details for each request
    let enrichedRequests: any[] = []
    if (pendingRequests && pendingRequests.length > 0) {
      enrichedRequests = await Promise.all(
        pendingRequests.map(async (req) => {
          const { data: patient } = await supabase
            .schema('api')
            .from('patients')
            .select('first_name, last_name')
            .eq('id', req.patient_id)
            .single()
          
          return {
            ...req,
            patients: patient
          }
        })
      )
    }
    
    console.log('📋 [AI SCHEDULER] Loaded', enrichedRequests?.length || 0, 'pending requests for context')

    // Step 1: Parse the natural language input with AI
    const parseResult = await parseAppointmentRequest(
      naturalLanguageInput,
      undefined,
      recentPatients || undefined,
      enrichedRequests.length > 0 ? enrichedRequests : undefined
    )
    
    if (!parseResult.success || !parseResult.data) {
      console.error('❌ [AI SCHEDULER] Failed to parse:', parseResult.error)
      return {
        success: false,
        error: parseResult.error || 'Failed to understand the appointment request.'
      }
    }

    const parsed = parseResult.data
    console.log('✅ [AI SCHEDULER] Parsed request:', parsed)

    // Step 2: Find the patient by name
    
    // Try to find patient by full name or split names
    let patientQuery = supabase
      .schema('api')
      .from('patients')
      .select('id, first_name, last_name, email')
    
    // Search by full name match or partial match
    if (parsed.patientFirstName && parsed.patientLastName) {
      patientQuery = patientQuery
        .ilike('first_name', `%${parsed.patientFirstName}%`)
        .ilike('last_name', `%${parsed.patientLastName}%`)
    } else {
      // Try full name in both fields
      const nameParts = parsed.patientName.trim().split(' ')
      if (nameParts.length >= 2) {
        const firstName = nameParts[0]
        const lastName = nameParts.slice(1).join(' ')
        patientQuery = patientQuery
          .or(`first_name.ilike.%${firstName}%,last_name.ilike.%${lastName}%`)
      } else {
        // Single name - search both fields
        patientQuery = patientQuery
          .or(`first_name.ilike.%${parsed.patientName}%,last_name.ilike.%${parsed.patientName}%`)
      }
    }

    const { data: patients, error: patientError } = await patientQuery.limit(5)

    if (patientError) {
      console.error('❌ [AI SCHEDULER] Patient search error:', patientError)
      return {
        success: false,
        error: 'Failed to search for patient in database.'
      }
    }

    if (!patients || patients.length === 0) {
      console.warn('⚠️ [AI SCHEDULER] No patient found for:', parsed.patientName)
      return {
        success: false,
        error: `Patient "${parsed.patientName}" not found. Please check the name and try again.`,
        parsedRequest: parsed
      }
    }

    if (patients.length > 1) {
      const patientList = patients.map(p => `${p.first_name} ${p.last_name}`).join(', ')
      console.warn('⚠️ [AI SCHEDULER] Multiple patients found:', patientList)
      return {
        success: false,
        error: `Multiple patients found matching "${parsed.patientName}": ${patientList}. Please be more specific.`,
        parsedRequest: parsed
      }
    }

    const patient = patients[0]
    console.log('✅ [AI SCHEDULER] Found patient:', `${patient.first_name} ${patient.last_name}`)

    // Step 3: Determine if this is a first visit for the patient
    const { data: existingAppointments } = await supabase
      .schema('api')
      .from('appointments')
      .select('id')
      .eq('patient_id', patient.id)
      .limit(1)
    
    const isFirstVisit = !existingAppointments || existingAppointments.length === 0
    
    // If AI detected first_visit or this is truly a first visit, set type accordingly
    if (parsed.appointmentType === 'first_visit' || (isFirstVisit && parsed.appointmentType === 'consultation')) {
      parsed.appointmentType = 'first_visit'
      console.log('✅ [AI SCHEDULER] Detected first visit for patient')
    }

    // Step 4: Find consultation and treatment context
    let consultationId: string | undefined
    let treatmentId: string | undefined
    let toothDiagnosisId: string | undefined

    // First priority: Check if tooth number is specified
    if (parsed.toothNumber) {
      console.log('🦷 [AI SCHEDULER] Looking for context with tooth:', parsed.toothNumber)

      // Try to find active diagnosis for this tooth
      const { data: toothDiagnoses } = await supabase
        .schema('api')
        .from('tooth_diagnoses')
        .select(`
          id,
          consultation_id,
          tooth_number,
          primary_diagnosis,
          status
        `)
        .eq('patient_id', patient.id)
        .eq('tooth_number', parsed.toothNumber)
        .in('status', ['active', 'attention', 'caries', 'root_canal'])
        .order('created_at', { ascending: false })
        .limit(1)

      if (toothDiagnoses && toothDiagnoses.length > 0) {
        const toothDiag = toothDiagnoses[0]
        consultationId = toothDiag.consultation_id
        toothDiagnosisId = toothDiag.id
        console.log('✅ [AI SCHEDULER] Found consultation context from tooth:', consultationId)

        // Try to find associated treatment
        const { data: treatments } = await supabase
          .schema('api')
          .from('treatments')
          .select('id, treatment_name, planned_status')
          .eq('patient_id', patient.id)
          .eq('consultation_id', consultationId)
          .eq('tooth_number', parsed.toothNumber)
          .in('planned_status', ['Planned', 'In Progress'])
          .order('created_at', { ascending: false })
          .limit(1)

        if (treatments && treatments.length > 0) {
          treatmentId = treatments[0].id
          console.log('✅ [AI SCHEDULER] Found treatment context:', treatmentId)
          
          // If we found a planned treatment, this should be a treatment appointment
          if (parsed.appointmentType === 'consultation') {
            parsed.appointmentType = 'treatment'
            console.log('✅ [AI SCHEDULER] Changed to treatment type based on planned treatment')
          }
        }
      }
    }
    
    // If no consultation found yet and appointment type requires it, find most recent consultation
    if (!consultationId && (parsed.appointmentType === 'treatment' || parsed.appointmentType === 'follow_up')) {
      console.log('🔍 [AI SCHEDULER] Finding most recent consultation for patient...')
      
      const { data: consultations } = await supabase
        .schema('api')
        .from('consultations')
        .select('id, created_at')
        .eq('patient_id', patient.id)
        .order('created_at', { ascending: false })
        .limit(1)
      
      if (consultations && consultations.length > 0) {
        consultationId = consultations[0].id
        console.log('✅ [AI SCHEDULER] Found most recent consultation:', consultationId)
      } else {
        // For treatment/follow-up without consultation, change to consultation type
        console.log('⚠️ [AI SCHEDULER] No consultation exists for treatment/follow-up, changing to consultation')
        parsed.appointmentType = 'consultation'
      }
    }

    // Step 5: Create the contextual appointment
    console.log('📅 [AI SCHEDULER] Creating appointment...')
    console.log('📊 [AI SCHEDULER] Appointment type:', parsed.appointmentType)
    console.log('📊 [AI SCHEDULER] Context - Consultation:', consultationId, '| Treatment:', treatmentId, '| Tooth Diagnosis:', toothDiagnosisId)
    
    const appointmentResult = await createContextualAppointment({
      patientId: patient.id,
      dentistId: dentistId,
      scheduledDate: parsed.date,
      scheduledTime: `${parsed.time}:00`, // Add seconds
      durationMinutes: parsed.duration || (parsed.appointmentType === 'treatment' ? 60 : 30),
      notes: parsed.notes || `AI-scheduled: ${parsed.rawInput}`,
      appointmentType: parsed.appointmentType,
      consultationId: consultationId,
      treatmentId: treatmentId,
      toothNumbers: parsed.toothNumber ? [parsed.toothNumber] : undefined,
      toothDiagnosisIds: toothDiagnosisId ? [toothDiagnosisId] : undefined
    })

    if (!appointmentResult.success || !appointmentResult.data) {
      console.error('❌ [AI SCHEDULER] Failed to create appointment:', appointmentResult.error)
      return {
        success: false,
        error: appointmentResult.error || 'Failed to create appointment.',
        parsedRequest: parsed
      }
    }

    console.log('✅ [AI SCHEDULER] Appointment created successfully:', appointmentResult.data.id)

    // Generate confirmation message
    const confirmationMessage = generateAppointmentConfirmation(parsed)

    // Revalidate relevant pages
    revalidatePath('/assistant')
    revalidatePath('/dentist')
    revalidatePath('/patient')

    return {
      success: true,
      message: confirmationMessage,
      appointmentId: appointmentResult.data.id,
      parsedRequest: parsed,
      confidence: parsed.confidence
    }

  } catch (error) {
    console.error('❌ [AI SCHEDULER] Unexpected error:', error)
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred.'
    }
  }
}

/**
 * Get appointment scheduling suggestions based on patient context
 */
export async function getAppointmentSuggestions(
  patientId: string
): Promise<{ success: boolean; suggestions?: string[]; error?: string }> {
  
  try {
    const supabase = await createServiceClient()

    // Get pending treatments for the patient
    const { data: treatments, error } = await supabase
      .schema('api')
      .from('treatments')
      .select(`
        id,
        treatment_name,
        tooth_number,
        planned_status,
        tooth_diagnoses (
          primary_diagnosis
        )
      `)
      .eq('patient_id', patientId)
      .eq('planned_status', 'Planned')
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) {
      console.error('Error fetching treatment suggestions:', error)
      return { success: false, error: 'Failed to fetch suggestions' }
    }

    const suggestions = treatments?.map(t => {
      const toothInfo = t.tooth_number ? ` on tooth ${t.tooth_number}` : ''
      return `Schedule ${t.treatment_name}${toothInfo}`
    }) || []

    return {
      success: true,
      suggestions
    }

  } catch (error) {
    console.error('Error in getAppointmentSuggestions:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
