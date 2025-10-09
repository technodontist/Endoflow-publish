'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser } from './auth'

/**
 * Complete patient medical context for RAG-enhanced AI responses
 */
export interface PatientMedicalContext {
  patientId: string
  patientName: string
  
  // Consultation History
  consultations: {
    id: string
    date: string
    chiefComplaint: string
    diagnosis: string
    treatmentPlan: string
    dentistName: string
    status: string
  }[]
  
  // Tooth-level Diagnoses
  toothDiagnoses: {
    toothNumber: string
    diagnosis: string
    treatment: string
    status: string
    date: string
    severity?: string
    notes?: string
  }[]
  
  // Treatment History
  completedTreatments: {
    toothNumber: string | null
    treatment: string
    date: string
    outcome: string
    dentistName: string
  }[]
  
  plannedTreatments: {
    toothNumber: string
    treatment: string
    priority: string
    notes: string
  }[]
  
  // Follow-ups
  followUps: {
    date: string
    instructions: string
    status: string
    type: string
  }[]
  
  // Medical History
  medicalHistory: {
    allergies: string[]
    medications: string[]
    conditions: string[]
    contraindications: string[]
  }
  
  // Summary Statistics
  summary: {
    totalConsultations: number
    activeIssues: number
    pendingTreatments: number
    lastVisitDate: string | null
  }
}

/**
 * Fetch complete patient medical context from database
 * Includes consultations, diagnoses, treatments, and medical history
 * 
 * @param patientId - Patient ID to fetch context for
 * @returns Complete patient medical context or error
 */
export async function getPatientFullContext(
  patientId: string
): Promise<{ success: boolean; data?: PatientMedicalContext; error?: string }> {
  console.log('🔍 [PATIENT-CONTEXT] Fetching full medical context for patient:', patientId)
  
  try {
    // Verify authentication
    const user = await getCurrentUser()
    if (!user || user.role !== 'dentist') {
      return { success: false, error: 'Only dentists can access patient medical context' }
    }

    const supabase = await createServiceClient()
    
    // Fetch patient basic info
    const { data: patient, error: patientError } = await supabase
      .schema('api')
      .from('patients')
      .select('id, first_name, last_name, email, date_of_birth, phone')
      .eq('id', patientId)
      .single()
    
    if (patientError || !patient) {
      console.error('❌ [PATIENT-CONTEXT] Patient not found:', patientError)
      return { success: false, error: 'Patient not found' }
    }

    const patientName = `${patient.first_name} ${patient.last_name}`
    console.log('✅ [PATIENT-CONTEXT] Found patient:', patientName)

    // Fetch all consultations
    const { data: consultations, error: consultationsError } = await supabase
      .schema('api')
      .from('consultations')
      .select(`
        id,
        consultation_date,
        status,
        chief_complaint,
        diagnosis,
        treatment_plan,
        dentist_id,
        created_at
      `)
      .eq('patient_id', patientId)
      .order('consultation_date', { ascending: false })
    
    console.log(`📋 [PATIENT-CONTEXT] Found ${consultations?.length || 0} consultations`)

    // Fetch dentist names for consultations
    const dentistIds = [...new Set(consultations?.map(c => c.dentist_id).filter(Boolean) || [])]
    let dentistsMap = new Map<string, string>()
    
    if (dentistIds.length > 0) {
      const { data: dentists } = await supabase
        .schema('api')
        .from('dentists')
        .select('id, full_name')
        .in('id', dentistIds)
      
      dentists?.forEach(d => dentistsMap.set(d.id, d.full_name))
    }

    // Fetch all tooth diagnoses
    const { data: toothDiagnoses, error: toothError } = await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .select(`
        id,
        consultation_id,
        tooth_number,
        primary_diagnosis,
        secondary_diagnosis,
        recommended_treatment,
        severity,
        notes,
        status,
        created_at
      `)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
    
    console.log(`🦷 [PATIENT-CONTEXT] Found ${toothDiagnoses?.length || 0} tooth diagnoses`)

    // Fetch treatment history
    const { data: treatments, error: treatmentsError } = await supabase
      .schema('api')
      .from('treatments')
      .select(`
        id,
        treatment_name,
        tooth_number,
        status,
        treatment_date,
        outcome,
        dentist_id,
        notes,
        created_at
      `)
      .eq('patient_id', patientId)
      .order('treatment_date', { ascending: false })
    
    console.log(`💉 [PATIENT-CONTEXT] Found ${treatments?.length || 0} treatments`)

    // Fetch follow-up appointments
    const { data: followUpAppointments, error: followUpError } = await supabase
      .schema('api')
      .from('appointments')
      .select(`
        id,
        scheduled_date,
        appointment_type,
        status,
        notes
      `)
      .eq('patient_id', patientId)
      .eq('appointment_type', 'follow-up')
      .order('scheduled_date', { ascending: false })
    
    console.log(`📅 [PATIENT-CONTEXT] Found ${followUpAppointments?.length || 0} follow-ups`)

    // Extract medical history from consultations (stored as JSONB)
    // Get the most recent consultation with medical history data
    const medicalHistoryData: any = {}
    
    if (consultations && consultations.length > 0) {
      // Try to find most recent consultation with medical_history data
      for (const consultation of consultations) {
        if (consultation.medical_history) {
          try {
            const parsedHistory = typeof consultation.medical_history === 'string' 
              ? JSON.parse(consultation.medical_history)
              : consultation.medical_history
            
            // Merge medical history data (most recent takes precedence)
            if (parsedHistory.conditions || parsedHistory.medical_conditions) {
              medicalHistoryData.conditions = parsedHistory.conditions || parsedHistory.medical_conditions || []
            }
            if (parsedHistory.medications || parsedHistory.current_medications) {
              medicalHistoryData.medications = parsedHistory.medications || parsedHistory.current_medications || []
            }
            if (parsedHistory.allergies) {
              medicalHistoryData.allergies = parsedHistory.allergies || []
            }
            
            // If we found data, use it (most recent consultation)
            if (Object.keys(medicalHistoryData).length > 0) {
              console.log('✅ [PATIENT-CONTEXT] Found medical history in consultation:', consultation.id)
              break
            }
          } catch (error) {
            console.error('Error parsing medical history from consultation:', error)
          }
        }
      }
    }

    // Structure consultation data
    const consultationData = consultations?.map(c => {
      // Parse JSON fields
      const parseDiagnosis = (d: any) => {
        try {
          if (typeof d === 'string') return JSON.parse(d)
          return d || {}
        } catch {
          return { final: d || 'Not specified' }
        }
      }
      
      const parseTreatmentPlan = (t: any) => {
        try {
          if (typeof t === 'string') return JSON.parse(t)
          return t || {}
        } catch {
          return { plan: t || 'Not specified' }
        }
      }

      const diagnosisData = parseDiagnosis(c.diagnosis)
      const treatmentPlanData = parseTreatmentPlan(c.treatment_plan)

      return {
        id: c.id,
        date: c.consultation_date,
        chiefComplaint: c.chief_complaint || 'Not specified',
        diagnosis: diagnosisData.final || diagnosisData.provisional || 'Diagnosis pending',
        treatmentPlan: treatmentPlanData.plan || 'Treatment plan pending',
        dentistName: dentistsMap.get(c.dentist_id) || 'Unknown',
        status: c.status || 'completed'
      }
    }) || []

    // Structure tooth diagnoses
    const toothDiagnosisData = toothDiagnoses?.map(td => ({
      toothNumber: td.tooth_number,
      diagnosis: td.primary_diagnosis || 'Not specified',
      treatment: td.recommended_treatment || 'To be determined',
      status: td.status || 'active',
      date: td.created_at,
      severity: td.severity,
      notes: td.notes
    })) || []

    // Separate completed vs planned treatments
    const completedTreatments = treatments
      ?.filter(t => t.status === 'completed')
      .map(t => ({
        toothNumber: t.tooth_number,
        treatment: t.treatment_name || 'Treatment',
        date: t.treatment_date || t.created_at,
        outcome: t.outcome || 'Successful',
        dentistName: dentistsMap.get(t.dentist_id) || 'Unknown'
      })) || []

    const plannedTreatments = treatments
      ?.filter(t => t.status === 'planned' || t.status === 'pending')
      .map(t => ({
        toothNumber: t.tooth_number || 'N/A',
        treatment: t.treatment_name || 'Treatment',
        priority: 'standard', // Could be enhanced with priority field
        notes: t.notes || ''
      })) || []

    // Structure follow-ups
    const followUpData = followUpAppointments?.map(f => ({
      date: f.scheduled_date,
      instructions: f.notes || 'Standard follow-up',
      status: f.status || 'scheduled',
      type: f.appointment_type || 'follow-up'
    })) || []

    // Extract medical history
    const medicalHistory = {
      allergies: medicalHistoryData.allergies || [],
      medications: medicalHistoryData.medications || [],
      conditions: medicalHistoryData.conditions || [],
      contraindications: medicalHistoryData.contraindications || []
    }

    // Calculate summary statistics
    const activeIssues = toothDiagnosisData.filter(d => 
      d.status === 'active' || d.status === 'ongoing'
    ).length

    const lastVisitDate = consultationData.length > 0 
      ? consultationData[0].date 
      : null

    const summary = {
      totalConsultations: consultationData.length,
      activeIssues,
      pendingTreatments: plannedTreatments.length,
      lastVisitDate
    }

    const fullContext: PatientMedicalContext = {
      patientId,
      patientName,
      consultations: consultationData,
      toothDiagnoses: toothDiagnosisData,
      completedTreatments,
      plannedTreatments,
      followUps: followUpData,
      medicalHistory,
      summary
    }

    console.log('✅ [PATIENT-CONTEXT] Full context assembled:', {
      consultations: consultationData.length,
      diagnoses: toothDiagnosisData.length,
      completedTreatments: completedTreatments.length,
      plannedTreatments: plannedTreatments.length,
      followUps: followUpData.length,
      activeIssues
    })

    return { success: true, data: fullContext }

  } catch (error) {
    console.error('❌ [PATIENT-CONTEXT] Error fetching patient context:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch patient context' 
    }
  }
}

/**
 * Format patient medical context into a structured string for AI prompts
 * This is a utility function used by RAG service, not a server action
 * @param context - Patient medical context
 * @returns Formatted context string
 */
function formatPatientMedicalContextInternal(context: PatientMedicalContext): string {
  const sections: string[] = []

  // Header
  sections.push(`
═══════════════════════════════════════════════════════════
PATIENT MEDICAL CONTEXT
═══════════════════════════════════════════════════════════
Patient: ${context.patientName}
Patient ID: ${context.patientId}
Last Visit: ${context.summary.lastVisitDate ? new Date(context.summary.lastVisitDate).toLocaleDateString() : 'No visits recorded'}
Total Consultations: ${context.summary.totalConsultations}
Active Issues: ${context.summary.activeIssues}
Pending Treatments: ${context.summary.pendingTreatments}
`)

  // Medical History (IMPORTANT - show first for safety)
  if (context.medicalHistory.allergies.length > 0 || 
      context.medicalHistory.medications.length > 0 ||
      context.medicalHistory.conditions.length > 0 ||
      context.medicalHistory.contraindications.length > 0) {
    sections.push(`
───────────────────────────────────────────────────────────
⚠️  MEDICAL HISTORY & ALERTS
───────────────────────────────────────────────────────────`)
    
    if (context.medicalHistory.allergies.length > 0) {
      sections.push(`🚨 ALLERGIES: ${context.medicalHistory.allergies.join(', ')}`)
    }
    if (context.medicalHistory.medications.length > 0) {
      sections.push(`💊 MEDICATIONS: ${context.medicalHistory.medications.join(', ')}`)
    }
    if (context.medicalHistory.conditions.length > 0) {
      sections.push(`🏥 CONDITIONS: ${context.medicalHistory.conditions.join(', ')}`)
    }
    if (context.medicalHistory.contraindications.length > 0) {
      sections.push(`⚠️  CONTRAINDICATIONS: ${context.medicalHistory.contraindications.join(', ')}`)
    }
  } else {
    sections.push(`
───────────────────────────────────────────────────────────
MEDICAL HISTORY
───────────────────────────────────────────────────────────
No significant medical history, allergies, or contraindications reported.`)
  }

  // Consultation History
  if (context.consultations.length > 0) {
    sections.push(`
───────────────────────────────────────────────────────────
CONSULTATION HISTORY (${context.consultations.length} visits)
───────────────────────────────────────────────────────────`)
    
    context.consultations.slice(0, 5).forEach((c, idx) => {
      sections.push(`
${idx + 1}. Date: ${new Date(c.date).toLocaleDateString()}
   Chief Complaint: ${c.chiefComplaint}
   Diagnosis: ${c.diagnosis}
   Treatment Plan: ${c.treatmentPlan}
   Provider: ${c.dentistName}
   Status: ${c.status}`)
    })

    if (context.consultations.length > 5) {
      sections.push(`\n... and ${context.consultations.length - 5} more consultations`)
    }
  }

  // Active Diagnoses
  const activeDiagnoses = context.toothDiagnoses.filter(d => 
    d.status === 'active' || d.status === 'ongoing'
  )
  
  if (activeDiagnoses.length > 0) {
    sections.push(`
───────────────────────────────────────────────────────────
🦷 ACTIVE DIAGNOSES (${activeDiagnoses.length})
───────────────────────────────────────────────────────────`)
    
    activeDiagnoses.forEach((d, idx) => {
      sections.push(`
${idx + 1}. Tooth ${d.toothNumber}: ${d.diagnosis}
   Recommended Treatment: ${d.treatment}
   Severity: ${d.severity || 'Not specified'}
   Date Diagnosed: ${new Date(d.date).toLocaleDateString()}
   ${d.notes ? `Notes: ${d.notes}` : ''}`)
    })
  }

  // Completed Treatments
  if (context.completedTreatments.length > 0) {
    sections.push(`
───────────────────────────────────────────────────────────
✅ COMPLETED TREATMENTS (${context.completedTreatments.length})
───────────────────────────────────────────────────────────`)
    
    context.completedTreatments.slice(0, 5).forEach((t, idx) => {
      sections.push(`
${idx + 1}. ${t.treatment}${t.toothNumber ? ` on Tooth ${t.toothNumber}` : ''}
   Date: ${new Date(t.date).toLocaleDateString()}
   Outcome: ${t.outcome}
   Provider: ${t.dentistName}`)
    })

    if (context.completedTreatments.length > 5) {
      sections.push(`\n... and ${context.completedTreatments.length - 5} more completed treatments`)
    }
  }

  // Planned Treatments
  if (context.plannedTreatments.length > 0) {
    sections.push(`
───────────────────────────────────────────────────────────
📋 PLANNED TREATMENTS (${context.plannedTreatments.length})
───────────────────────────────────────────────────────────`)
    
    context.plannedTreatments.forEach((t, idx) => {
      sections.push(`
${idx + 1}. ${t.treatment} on Tooth ${t.toothNumber}
   Priority: ${t.priority}
   ${t.notes ? `Notes: ${t.notes}` : 'No additional notes'}`)
    })
  }

  // Follow-ups
  if (context.followUps.length > 0) {
    sections.push(`
───────────────────────────────────────────────────────────
📅 FOLLOW-UP APPOINTMENTS (${context.followUps.length})
───────────────────────────────────────────────────────────`)
    
    context.followUps.slice(0, 3).forEach((f, idx) => {
      sections.push(`
${idx + 1}. ${new Date(f.date).toLocaleDateString()} - ${f.type}
   Status: ${f.status}
   Instructions: ${f.instructions}`)
    })
  }

  sections.push(`
═══════════════════════════════════════════════════════════
END OF PATIENT MEDICAL CONTEXT
═══════════════════════════════════════════════════════════

IMPORTANT INSTRUCTIONS FOR AI:
1. Always consider the patient's medical history, allergies, and contraindications
2. Reference specific previous treatments and their outcomes when making recommendations
3. Prioritize patient safety based on known medical conditions
4. Suggest treatments that align with the existing treatment plan when appropriate
5. Consider the patient's treatment history to avoid repeating unsuccessful approaches
6. Provide patient-specific warnings based on medical alerts
`)

  return sections.join('\n')
}

// Export the formatting function (not a server action, just a utility)
export const formatPatientMedicalContext = formatPatientMedicalContextInternal
