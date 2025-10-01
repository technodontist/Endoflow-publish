'use server'

import { createServiceClient } from '@/lib/supabase/server'

export interface DiagnosisWithAppointment {
  id: string
  patient_id: string
  tooth_number: string | null
  diagnoses: string[]
  primary_diagnosis?: string | null
  status: 'active' | 'resolved' | 'monitoring' | 'referred'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  color_code?: string | null
  created_at: string
  updated_at: string
  consultation_id: string | null
  clinician_name?: string | null
  symptoms: string[]
  
  // Treatments linked to this diagnosis
  treatments?: Array<{
    id: string
    treatment_type: string
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
    appointment_id: string | null
    consultation_id?: string | null
    tooth_number?: string | null
  }>
  
  // Most relevant linked appointment (from a linked treatment or fallback mapping)
  appointment?: {
    id: string
    scheduled_date: string
    scheduled_time?: string | null
    duration?: number | null
    status: string
    dentist_name?: string
  } | null
}

export async function getPatientDiagnosisOverviewAction(patientId: string): Promise<{ success: boolean; data?: DiagnosisWithAppointment[]; error?: string }> {
  try {
    const supabase = await createServiceClient()

    // 1) Load all diagnoses for the patient
    const { data: diagRows, error: diagErr } = await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .select('*')
      .eq('patient_id', patientId)
      .order('updated_at', { ascending: false })

    if (diagErr) {
      console.error('[DIAGNOSIS-OVERVIEW] Error fetching diagnoses:', diagErr)
      return { success: false, error: 'Failed to fetch diagnoses' }
    }

    const diagnosisIds = new Set((diagRows || []).map((d: any) => d.id))

    // 2) Load all treatments for the patient (with joined appointment basics)
    const { data: treatments, error: trErr } = await supabase
      .schema('api')
      .from('treatments')
      .select(`
        id,
        patient_id,
        dentist_id,
        appointment_id,
        treatment_type,
        status,
        consultation_id,
        tooth_number,
        tooth_diagnosis_id,
        created_at,
        updated_at,
        appointments!fk_treatments_appointments (
          id,
          scheduled_date,
          scheduled_time,
          status,
          duration_minutes
        )
      `)
      .eq('patient_id', patientId)

    if (trErr) {
      console.error('[DIAGNOSIS-OVERVIEW] Error fetching treatments:', trErr)
      return { success: false, error: 'Failed to fetch treatments for diagnoses' }
    }

    // 3) Build maps
    const treatmentsByDiagnosis = new Map<string, any[]>()
    const dentistIds = new Set<string>()

    for (const t of treatments || []) {
      if (t.dentist_id) dentistIds.add(t.dentist_id)
      const key = t.tooth_diagnosis_id || null
      if (key) {
        const arr = treatmentsByDiagnosis.get(key) || []
        arr.push(t)
        treatmentsByDiagnosis.set(key, arr)
      }
    }

    // Fetch dentist names in one shot
    let dentistNameById = new Map<string, string>()
    if (dentistIds.size > 0) {
      const { data: dentists } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', Array.from(dentistIds))
      dentistNameById = new Map((dentists || []).map((d: any) => [d.id, d.full_name || 'Unknown Dentist']))
    }

    // 4) Transform diagnoses with appointment linkage
    const resolvedSet = new Set(['filled', 'crown', 'root_canal', 'implant', 'missing', 'healthy'])

    const results: DiagnosisWithAppointment[] = (diagRows || []).map((diag: any) => {
      // Parse diagnoses text: primary_diagnosis may be comma-separated
      const diagnosesText = (diag.primary_diagnosis || '') as string
      const diagnoses = diagnosesText
        ? diagnosesText.split(',').map((s: string) => s.trim()).filter(Boolean)
        : []

      // Parse symptoms (stored as JSON string)
      let symptoms: string[] = []
      if (diag.symptoms) {
        try { symptoms = JSON.parse(diag.symptoms) } catch { symptoms = [] }
      }

      // Map priority from treatment_priority (routine -> low)
      const rawPriority = (diag.treatment_priority || 'medium').toLowerCase()
      const priority = (rawPriority === 'routine' ? 'low' : rawPriority) as 'low' | 'medium' | 'high' | 'urgent'

      // Derive overview status from tooth status
      let overviewStatus: 'active' | 'resolved' | 'monitoring' | 'referred' = 'active'
      if (resolvedSet.has(String(diag.status))) overviewStatus = 'resolved'
      if (diag.follow_up_required) overviewStatus = 'monitoring'

      // Treatments linked by tooth_diagnosis_id
      const linkedTreatments = (treatmentsByDiagnosis.get(diag.id) || []).map((t: any) => ({
        id: t.id,
        treatment_type: t.treatment_type,
        status: t.status,
        appointment_id: t.appointment_id,
        consultation_id: t.consultation_id,
        tooth_number: t.tooth_number
      }))

      // Choose most relevant appointment from treatments
      let appointment: DiagnosisWithAppointment['appointment'] = null
      const pick = (treatmentsByDiagnosis.get(diag.id) || [])
        .sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      const candidate = pick.find((t: any) => t.appointments) || pick.find((t: any) => !!t.appointment_id)
      if (candidate?.appointments) {
        appointment = {
          id: candidate.appointments.id,
          scheduled_date: candidate.appointments.scheduled_date,
          scheduled_time: candidate.appointments.scheduled_time,
          status: candidate.appointments.status,
          duration: candidate.appointments.duration_minutes,
          dentist_name: candidate.dentist_id ? (dentistNameById.get(candidate.dentist_id) || 'Unknown Dentist') : 'Unknown Dentist'
        }
      }

      const out: DiagnosisWithAppointment = {
        id: diag.id,
        patient_id: diag.patient_id,
        tooth_number: diag.tooth_number || null,
        diagnoses,
        primary_diagnosis: diag.primary_diagnosis,
        status: overviewStatus,
        priority,
        color_code: diag.color_code || null,
        created_at: diag.created_at,
        updated_at: diag.updated_at,
        consultation_id: diag.consultation_id || null,
        clinician_name: null,
        symptoms,
        treatments: linkedTreatments,
        appointment
      }

      return out
    })

    return { success: true, data: results }
  } catch (error) {
    console.error('[DIAGNOSIS-OVERVIEW] Exception:', error)
    return { success: false, error: 'Unexpected error fetching diagnosis overview' }
  }
}

export async function getPatientDiagnosisStatsAction(patientId: string): Promise<{ success: boolean; data?: { total: number; active: number; resolved: number; monitoring: number; referred: number; highPriority: number; urgent: number }; error?: string }> {
  try {
    const supabase = await createServiceClient()

    const { data: diagRows, error } = await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .select('status, follow_up_required, treatment_priority')
      .eq('patient_id', patientId)

    if (error) {
      console.error('[DIAGNOSIS-OVERVIEW] Error fetching stats:', error)
      return { success: false, error: 'Failed to fetch diagnosis stats' }
    }

    const resolvedSet = new Set(['filled', 'crown', 'root_canal', 'implant', 'missing', 'healthy'])

    let total = 0, active = 0, resolved = 0, monitoring = 0, referred = 0, highPriority = 0, urgent = 0
    for (const d of (diagRows || [])) {
      total++
      const isResolved = resolvedSet.has(String((d as any).status))
      const isMonitoring = !!(d as any).follow_up_required
      if (isMonitoring) monitoring++
      else if (isResolved) resolved++
      else active++

      const pr = String((d as any).treatment_priority || 'medium').toLowerCase()
      if (pr === 'urgent') urgent++
      if (pr === 'urgent' || pr === 'high') highPriority++
    }

    return { success: true, data: { total, active, resolved, monitoring, referred, highPriority, urgent } }
  } catch (error) {
    console.error('[DIAGNOSIS-OVERVIEW] Stats exception:', error)
    return { success: false, error: 'Failed to calculate diagnosis statistics' }
  }
}
