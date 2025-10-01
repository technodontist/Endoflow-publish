'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser } from './auth'

export interface ConsultationData {
  id: string
  consultationDate: string
  dentistId: string
  dentistName: string
  appointmentId?: string
  chiefComplaint?: string
  hopi?: string // History of Present Illness
  painScore?: number
  symptoms?: string[]
  medicalHistory?: string
  diagnosis?: string
  treatmentPlan?: string
  treatmentDone?: string
  followUpInstructions?: string
  nextAppointmentDate?: string
  clinicalFindings?: string
  notes?: string
  attachedFiles?: {
    id: string
    fileName: string
    fileType: string
    description: string
    createdAt: string
  }[]
}

// For now, I'll create consultation data from appointments and treatments
// In a real system, you might have a dedicated consultations table
export async function getPatientConsultations(patientId?: string): Promise<{ success: boolean; data?: ConsultationData[]; error?: string }> {
  console.log('🔍 [CONSULTATIONS] Fetching consultations for patient:', patientId)
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Use provided patientId or current user's ID for patient role
    const targetPatientId = patientId || (user.role === 'patient' ? user.id : null)
    
    console.log('🔍 [CONSULTATIONS] User role:', user.role, 'Target patient ID:', targetPatientId)
    
    if (!targetPatientId) {
      console.log('❌ [CONSULTATIONS] No target patient ID')
      return { success: false, error: 'Patient ID required' }
    }

    // Verify patient access
    if (user.role === 'patient' && user.id !== targetPatientId) {
      return { success: false, error: 'Access denied' }
    }

    const supabase = await createServiceClient()

    
    // Get actual consultations from the consultations table
    const { data: consultations, error: consultationsError } = await supabase
      .schema('api')
      .from('consultations')
      .select(`
        id,
        consultation_date,
        status,
        chief_complaint,
        pain_assessment,
        medical_history,
        clinical_examination,
        investigations,
        diagnosis,
        treatment_plan,
        prescription_data,
        follow_up_data,
        additional_notes,
        dentist_id,
        patient_id,
        created_at
      `)
      .eq('patient_id', targetPatientId)
      .order('consultation_date', { ascending: false })

    console.log('🔍 [CONSULTATIONS] Consultations query result:', { consultations: consultations?.length, error: consultationsError })
    if (consultationsError) {
      console.error('Error fetching consultations:', consultationsError)
      return { success: false, error: 'Failed to fetch consultation data' }
    }

    // Get dentist information separately since we can't rely on foreign key relationships yet
    let dentistsData: any[] = []
    if (consultations && consultations.length > 0) {
      const dentistIds = [...new Set(consultations.map(c => c.dentist_id).filter(Boolean))]
      if (dentistIds.length > 0) {
        // Try to get dentist data from the dentists table
        const { data: dentists, error: dentistsError } = await supabase
          .schema('api')
          .from('dentists')
          .select('id, full_name, specialty')
          .in('id', dentistIds)
        
        if (!dentistsError && dentists) {
          dentistsData = dentists
        } else {
          console.log('🔍 [CONSULTATIONS] Could not fetch dentists data:', dentistsError)
          // Fallback: try to get from profiles table
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', dentistIds)
            .eq('role', 'dentist')
          
          if (!profilesError && profiles) {
            dentistsData = profiles.map(p => ({ ...p, specialty: null }))
          }
        }
      }
    }

    // Get tooth diagnoses linked to these consultations
    const consultationIds = consultations?.map(consultation => consultation.id) || []
    let toothDiagnoses: any[] = []

    if (consultationIds.length > 0) {
      const { data: toothData, error: toothError } = await supabase
        .schema('api')
        .from('tooth_diagnoses')
        .select(`
          id,
          consultation_id,
          tooth_number,
          primary_diagnosis,
          recommended_treatment,
          notes,
          created_at
        `)
        .in('consultation_id', consultationIds)

      if (!toothError) {
        toothDiagnoses = toothData || []
      }
    }

    // Get patient files that might be linked to consultations
    const { data: files, error: filesError } = await supabase
      .schema('api')
      .from('patient_files')
      .select(`
        id,
        file_name,
        original_file_name,
        file_type,
        description,
        created_at
      `)
      .eq('patient_id', targetPatientId)
      .order('created_at', { ascending: false })

    // Create consultation data from actual consultation records
    const consultationData: ConsultationData[] = []

    consultations?.forEach(consultation => {
      // Find dentist information for this consultation
      const consultationDentist = dentistsData.find(d => d.id === consultation.dentist_id)
      
      // Find tooth diagnoses for this consultation
      const consultationToothDiagnoses = toothDiagnoses.filter(t => t.consultation_id === consultation.id)
      
      // Find files from the same day (rough association)
      const consultationDate = new Date(consultation.consultation_date)
      const dayStart = new Date(consultationDate)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(consultationDate)
      dayEnd.setHours(23, 59, 59, 999)
      
      const dayFiles = files?.filter(file => {
        const fileDate = new Date(file.created_at)
        return fileDate >= dayStart && fileDate <= dayEnd
      }) || []

      // Parse JSON fields safely
      const parseJSON = (jsonString: string) => {
        try {
          return jsonString ? JSON.parse(jsonString) : null
        } catch {
          return null
        }
      }

      const painAssessment = parseJSON(consultation.pain_assessment)
      const medicalHistory = parseJSON(consultation.medical_history)
      const diagnosis = parseJSON(consultation.diagnosis)
      const treatmentPlan = parseJSON(consultation.treatment_plan)
      const clinicalExamination = parseJSON(consultation.clinical_examination)
      const followUpData = parseJSON(consultation.follow_up_data)

      // Create consultation data from actual database record
      const consultationRecord: ConsultationData = {
        id: consultation.id,
        consultationDate: consultation.consultation_date,
        dentistId: consultation.dentist_id,
        dentistName: consultationDentist?.full_name || 'Unknown Dentist',
        appointmentId: undefined, // Not linked to appointments in this system
        chiefComplaint: consultation.chief_complaint || 'No chief complaint recorded',
        hopi: 'History of present illness documented during consultation',
        painScore: painAssessment?.intensity || 0,
        symptoms: painAssessment ? [
          painAssessment.character,
          painAssessment.triggers,
          painAssessment.location
        ].filter(Boolean) : [],
        medicalHistory: medicalHistory ? [
          medicalHistory.conditions,
          medicalHistory.medications,
          medicalHistory.allergies
        ].filter(Boolean).join('; ') : 'No significant medical history',
        diagnosis: diagnosis?.final || diagnosis?.provisional || 'Diagnosis documented',
        treatmentPlan: treatmentPlan?.plan || 'Treatment plan developed',
        treatmentDone: consultationToothDiagnoses.map(t => 
          `Tooth ${t.tooth_number}: ${t.recommended_treatment || t.primary_diagnosis}`
        ).join('; ') || 'Consultation completed',
        followUpInstructions: followUpData?.instructions || 'Standard post-consultation care',
        clinicalFindings: [
          clinicalExamination?.extraoral,
          clinicalExamination?.intraoral,
          clinicalExamination?.periodontal
        ].filter(Boolean).join('; ') || 'Clinical examination completed',
        notes: consultation.additional_notes || 'No additional notes',
        attachedFiles: dayFiles.map(file => ({
          id: file.id,
          fileName: file.original_file_name,
          fileType: file.file_type,
          description: file.description,
          createdAt: file.created_at
        }))
      }

      consultationData.push(consultationRecord)
    })

    console.log('✅ [CONSULTATIONS] Processed consultation data:', consultationData.length, 'consultations')
    return { success: true, data: consultationData }
  } catch (error) {
    console.error('Error in getPatientConsultations:', error)
    return { success: false, error: 'Failed to fetch consultation data' }
  }
}
