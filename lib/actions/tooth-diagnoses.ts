'use server'

import { createServiceClient, createClient } from '@/lib/supabase/server'
import { getCurrentUser } from './auth'
import { revalidatePath } from 'next/cache'
import { getStatusColorCode, type ToothStatus } from '@/lib/utils/toothStatus'

export interface ToothDiagnosisData {
  id?: string
  consultationId?: string
  patientId: string
  toothNumber: string
  status: 'healthy' | 'caries' | 'filled' | 'crown' | 'missing' | 'attention' | 'root_canal' | 'extraction_needed' | 'implant'
  primaryDiagnosis?: string
  diagnosisDetails?: string
  symptoms?: string[] // Will be stored as JSON
  recommendedTreatment?: string
  treatmentPriority: 'urgent' | 'high' | 'medium' | 'low' | 'routine'
  treatmentDetails?: string
  estimatedDuration?: number // in minutes
  estimatedCost?: string
  colorCode?: string
  scheduledDate?: string
  followUpRequired?: boolean
  examinationDate?: string
  notes?: string
  createdAt?: string
  updatedAt?: string
}

export interface ToothChartData {
  [toothNumber: string]: ToothDiagnosisData
}

/**
 * Fetch the most recent tooth diagnosis for each tooth across all consultations for a patient
 * This provides the current baseline state of all teeth
 */
export async function getPatientLatestToothDiagnoses(
  patientId: string
): Promise<{ success: boolean; data?: ToothChartData; error?: string }> {
  console.log('🔍 [TOOTH-DIAGNOSES] Fetching latest tooth diagnoses for patient:', patientId)
  
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Verify access permissions
    if (user.role === 'patient' && user.id !== patientId) {
      return { success: false, error: 'Access denied' }
    }

    const supabase = await createServiceClient()

    // Use the database view to get latest tooth diagnoses efficiently
    const { data: latestDiagnoses, error } = await supabase
      .schema('api')
      .from('latest_tooth_diagnoses')
      .select('*')
      .eq('patient_id', patientId)

    if (error) {
      console.error('❌ [TOOTH-DIAGNOSES] Error fetching latest tooth diagnoses:', error)
      return { success: false, error: 'Failed to fetch tooth diagnoses' }
    }

    // Convert to tooth chart data format
    const toothChartData: ToothChartData = {}
    
    latestDiagnoses?.forEach(diagnosis => {
      // Parse symptoms from JSON string
      let symptoms: string[] = []
      if (diagnosis.symptoms) {
        try {
          symptoms = JSON.parse(diagnosis.symptoms)
        } catch {
          symptoms = []
        }
      }

      toothChartData[diagnosis.tooth_number] = {
        id: diagnosis.id,
        consultationId: diagnosis.consultation_id,
        patientId: diagnosis.patient_id,
        toothNumber: diagnosis.tooth_number,
        status: diagnosis.status,
        primaryDiagnosis: diagnosis.primary_diagnosis,
        diagnosisDetails: diagnosis.diagnosis_details,
        symptoms,
        recommendedTreatment: diagnosis.recommended_treatment,
        treatmentPriority: diagnosis.treatment_priority,
        treatmentDetails: diagnosis.treatment_details,
        estimatedDuration: diagnosis.estimated_duration,
        estimatedCost: diagnosis.estimated_cost,
        colorCode: diagnosis.color_code,
        scheduledDate: diagnosis.scheduled_date,
        followUpRequired: diagnosis.follow_up_required,
        examinationDate: diagnosis.examination_date,
        notes: diagnosis.notes,
        createdAt: diagnosis.created_at,
        updatedAt: diagnosis.updated_at
      }
    })

    console.log('✅ [TOOTH-DIAGNOSES] Successfully fetched latest tooth diagnoses:', Object.keys(toothChartData).length, 'teeth')
    return { success: true, data: toothChartData }
  } catch (error) {
    console.error('❌ [TOOTH-DIAGNOSES] Exception fetching latest tooth diagnoses:', error)
    return { success: false, error: 'Failed to fetch tooth diagnoses' }
  }
}

/**
 * Fetch all tooth diagnoses for a patient (optionally filtered by consultation)
 * If consultationId is provided, returns diagnoses for that specific consultation
 * If consultationId is null/undefined, returns the most recent diagnoses across all consultations
 */
export async function getPatientToothDiagnoses(
  patientId: string,
  consultationId?: string | null,
  useLatestForNewConsultation = true
): Promise<{ success: boolean; data?: ToothChartData; error?: string }> {
  console.log('🔍 [TOOTH-DIAGNOSES] Fetching tooth diagnoses for patient:', patientId, 'consultation:', consultationId, 'useLatest:', useLatestForNewConsultation)
  
  try {
    // If no consultation ID provided and we want latest for new consultation, use the dedicated function
    if (!consultationId && useLatestForNewConsultation) {
      console.log('🔄 [TOOTH-DIAGNOSES] Redirecting to get latest tooth diagnoses')
      return getPatientLatestToothDiagnoses(patientId)
    }

    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Verify access permissions
    if (user.role === 'patient' && user.id !== patientId) {
      return { success: false, error: 'Access denied' }
    }

    const supabase = await createServiceClient()

    // Build query conditions
    let query = supabase
      .schema('api')
      .from('tooth_diagnoses')
      .select('*')
      .eq('patient_id', patientId)

    if (consultationId) {
      query = query.eq('consultation_id', consultationId)
    }

    const { data: toothDiagnoses, error } = await query.order('tooth_number', { ascending: true })

    if (error) {
      console.error('❌ [TOOTH-DIAGNOSES] Error fetching tooth diagnoses:', error)
      return { success: false, error: 'Failed to fetch tooth diagnoses' }
    }

    // Convert to tooth chart format
    const toothChartData: ToothChartData = {}
    
    toothDiagnoses?.forEach(diagnosis => {
      // Parse symptoms from JSON string
      let symptoms: string[] = []
      if (diagnosis.symptoms) {
        try {
          symptoms = JSON.parse(diagnosis.symptoms)
        } catch {
          symptoms = []
        }
      }

      toothChartData[diagnosis.tooth_number] = {
        id: diagnosis.id,
        consultationId: diagnosis.consultation_id,
        patientId: diagnosis.patient_id,
        toothNumber: diagnosis.tooth_number,
        status: diagnosis.status,
        primaryDiagnosis: diagnosis.primary_diagnosis,
        diagnosisDetails: diagnosis.diagnosis_details,
        symptoms,
        recommendedTreatment: diagnosis.recommended_treatment,
        treatmentPriority: diagnosis.treatment_priority,
        treatmentDetails: diagnosis.treatment_details,
        estimatedDuration: diagnosis.estimated_duration,
        estimatedCost: diagnosis.estimated_cost,
        colorCode: diagnosis.color_code,
        scheduledDate: diagnosis.scheduled_date,
        followUpRequired: diagnosis.follow_up_required,
        examinationDate: diagnosis.examination_date,
        notes: diagnosis.notes,
        createdAt: diagnosis.created_at,
        updatedAt: diagnosis.updated_at
      }
    })

    console.log('✅ [TOOTH-DIAGNOSES] Successfully fetched tooth diagnoses:', Object.keys(toothChartData).length, 'teeth')
    return { success: true, data: toothChartData }
  } catch (error) {
    console.error('❌ [TOOTH-DIAGNOSES] Exception fetching tooth diagnoses:', error)
    return { success: false, error: 'Failed to fetch tooth diagnoses' }
  }
}

/**
 * Save or update a tooth diagnosis
 */
export async function saveToothDiagnosis(
  toothDiagnosisData: ToothDiagnosisData
): Promise<{ success: boolean; data?: ToothDiagnosisData; error?: string }> {
  console.log('🔍 [TOOTH-DIAGNOSES] Saving tooth diagnosis for tooth:', toothDiagnosisData.toothNumber)
  
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Only dentists and assistants can save tooth diagnoses
    if (!['dentist', 'assistant'].includes(user.role)) {
      return { success: false, error: 'Insufficient permissions' }
    }

    // Verify access to patient
    if (user.role === 'patient' && user.id !== toothDiagnosisData.patientId) {
      return { success: false, error: 'Access denied' }
    }

    const supabase = await createServiceClient()

    // Prepare data for database (convert symptoms array to JSON string)
    const dbData = {
      consultation_id: toothDiagnosisData.consultationId,
      patient_id: toothDiagnosisData.patientId,
      tooth_number: toothDiagnosisData.toothNumber,
      status: toothDiagnosisData.status,
      primary_diagnosis: toothDiagnosisData.primaryDiagnosis,
      diagnosis_details: toothDiagnosisData.diagnosisDetails,
      symptoms: toothDiagnosisData.symptoms ? JSON.stringify(toothDiagnosisData.symptoms) : null,
      recommended_treatment: toothDiagnosisData.recommendedTreatment,
      treatment_priority: toothDiagnosisData.treatmentPriority || 'medium',
      treatment_details: toothDiagnosisData.treatmentDetails,
      estimated_duration: toothDiagnosisData.estimatedDuration,
      estimated_cost: toothDiagnosisData.estimatedCost,
      color_code: toothDiagnosisData.colorCode || getStatusColorCode(toothDiagnosisData.status as ToothStatus),
      scheduled_date: toothDiagnosisData.scheduledDate,
      follow_up_required: toothDiagnosisData.followUpRequired || false,
      examination_date: toothDiagnosisData.examinationDate || new Date().toISOString().split('T')[0],
      notes: toothDiagnosisData.notes
    }

    let result
    if (toothDiagnosisData.id) {
      // Update existing record
      const { data, error } = await supabase
        .schema('api')
        .from('tooth_diagnoses')
        .update(dbData)
        .eq('id', toothDiagnosisData.id)
        .select()
        .single()
      
      result = { data, error }
    } else {
      // Check if record exists for this consultation and tooth combination
      const { data: existingData, error: checkError } = await supabase
        .schema('api')
        .from('tooth_diagnoses')
        .select('id')
        .eq('patient_id', toothDiagnosisData.patientId)
        .eq('tooth_number', toothDiagnosisData.toothNumber)
        .eq('consultation_id', toothDiagnosisData.consultationId || '')
        .maybeSingle()

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('❌ [TOOTH-DIAGNOSES] Error checking existing record:', checkError)
        return { success: false, error: 'Failed to check existing tooth diagnosis' }
      }

      if (existingData) {
        // Update existing record
        const { data, error } = await supabase
          .schema('api')
          .from('tooth_diagnoses')
          .update(dbData)
          .eq('id', existingData.id)
          .select()
          .single()
        
        result = { data, error }
      } else {
        // Insert new record
        const { data, error } = await supabase
          .schema('api')
          .from('tooth_diagnoses')
          .insert(dbData)
          .select()
          .single()
        
        result = { data, error }
      }
    }

    if (result.error) {
      console.error('❌ [TOOTH-DIAGNOSES] Error saving tooth diagnosis:', result.error)
      return { success: false, error: 'Failed to save tooth diagnosis' }
    }

    // Convert back to our format
    const savedDiagnosis = convertDbToToothDiagnosis(result.data)

    // Revalidate relevant paths
    revalidatePath('/dentist')
    revalidatePath('/assistant')

    console.log('✅ [TOOTH-DIAGNOSES] Successfully saved tooth diagnosis for tooth:', toothDiagnosisData.toothNumber)
    return { success: true, data: savedDiagnosis }
  } catch (error) {
    console.error('❌ [TOOTH-DIAGNOSES] Exception saving tooth diagnosis:', error)
    return { success: false, error: 'Failed to save tooth diagnosis' }
  }
}

/**
 * Delete a tooth diagnosis
 */
export async function deleteToothDiagnosis(
  diagnosisId: string
): Promise<{ success: boolean; error?: string }> {
  console.log('🔍 [TOOTH-DIAGNOSES] Deleting tooth diagnosis:', diagnosisId)
  
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Only dentists and assistants can delete tooth diagnoses
    if (!['dentist', 'assistant'].includes(user.role)) {
      return { success: false, error: 'Insufficient permissions' }
    }

    const supabase = await createServiceClient()

    const { error } = await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .delete()
      .eq('id', diagnosisId)

    if (error) {
      console.error('❌ [TOOTH-DIAGNOSES] Error deleting tooth diagnosis:', error)
      return { success: false, error: 'Failed to delete tooth diagnosis' }
    }

    // Revalidate relevant paths
    revalidatePath('/dentist')
    revalidatePath('/assistant')

    console.log('✅ [TOOTH-DIAGNOSES] Successfully deleted tooth diagnosis:', diagnosisId)
    return { success: true }
  } catch (error) {
    console.error('❌ [TOOTH-DIAGNOSES] Exception deleting tooth diagnosis:', error)
    return { success: false, error: 'Failed to delete tooth diagnosis' }
  }
}

/**
 * Get tooth diagnosis statistics for a patient
 */
export async function getToothDiagnosisStats(
  patientId: string
): Promise<{ success: boolean; data?: { healthy: number; caries: number; restorations: number; attention: number; total: number }; error?: string }> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Verify access permissions
    if (user.role === 'patient' && user.id !== patientId) {
      return { success: false, error: 'Access denied' }
    }

    const supabase = await createServiceClient()

    const { data: toothDiagnoses, error } = await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .select('status')
      .eq('patient_id', patientId)

    if (error) {
      console.error('❌ [TOOTH-DIAGNOSES] Error fetching tooth stats:', error)
      return { success: false, error: 'Failed to fetch tooth statistics' }
    }

    // Calculate statistics
    const stats = {
      healthy: 0,
      caries: 0,
      restorations: 0,
      attention: 0,
      total: toothDiagnoses?.length || 0
    }

    toothDiagnoses?.forEach(diagnosis => {
      switch (diagnosis.status) {
        case 'healthy':
          stats.healthy++
          break
        case 'caries':
          stats.caries++
          break
        case 'filled':
        case 'crown':
        case 'root_canal':
        case 'implant':
          stats.restorations++
          break
        case 'attention':
        case 'extraction_needed':
          stats.attention++
          break
      }
    })

    return { success: true, data: stats }
  } catch (error) {
    console.error('❌ [TOOTH-DIAGNOSES] Exception fetching tooth stats:', error)
    return { success: false, error: 'Failed to fetch tooth statistics' }
  }
}

// Using the centralized color utility from @/lib/utils/toothStatus

// Helper function to convert database record to ToothDiagnosisData
function convertDbToToothDiagnosis(dbRecord: any): ToothDiagnosisData {
  let symptoms: string[] = []
  if (dbRecord.symptoms) {
    try {
      symptoms = JSON.parse(dbRecord.symptoms)
    } catch {
      symptoms = []
    }
  }

  return {
    id: dbRecord.id,
    consultationId: dbRecord.consultation_id,
    patientId: dbRecord.patient_id,
    toothNumber: dbRecord.tooth_number,
    status: dbRecord.status,
    primaryDiagnosis: dbRecord.primary_diagnosis,
    diagnosisDetails: dbRecord.diagnosis_details,
    symptoms,
    recommendedTreatment: dbRecord.recommended_treatment,
    treatmentPriority: dbRecord.treatment_priority,
    treatmentDetails: dbRecord.treatment_details,
    estimatedDuration: dbRecord.estimated_duration,
    estimatedCost: dbRecord.estimated_cost,
    colorCode: dbRecord.color_code,
    scheduledDate: dbRecord.scheduled_date,
    followUpRequired: dbRecord.follow_up_required,
    examinationDate: dbRecord.examination_date,
    notes: dbRecord.notes,
    createdAt: dbRecord.created_at,
    updatedAt: dbRecord.updated_at
  }
}