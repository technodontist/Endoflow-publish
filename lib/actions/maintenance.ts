'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Build clinical_data object from legacy fields on a consultation row
function buildClinicalDataFromLegacy(row: any) {
  const pain = safeParse(row.pain_assessment)
  const med = safeParse(row.medical_history)
  const exam = safeParse(row.clinical_examination)
  const inv = safeParse(row.investigations)
  const diag = safeParse(row.diagnosis)
  const tplan = safeParse(row.treatment_plan)

  const clinical_data: any = {
    chief_complaint: row.chief_complaint || '',
    patient_info: {
      medical_history: med?.conditions || med?.history || [],
      medications: med?.medications || [],
      allergies: med?.allergies || []
    },
    symptoms: {
      pain_level: pain?.intensity ?? 0,
      pain_type: pain?.character || '',
      pain_triggers: pain?.triggers || [],
      duration: pain?.duration || '',
      location: pain?.location || ''
    },
    examination: {
      clinical_findings: exam?.intraoral || '',
      radiographic_findings: inv?.radiographic || '',
      extraoral_findings: exam?.extraoral || '',
      periodontal_status: exam?.periodontal || ''
    },
    diagnosis: {
      primary: diag?.final?.[0] || '',
      secondary: diag?.final?.[1] || '',
      provisional: diag?.provisional || [],
      differential: diag?.differential || []
    },
    treatment_plan: {
      recommended: Array.isArray(tplan?.plan) ? tplan.plan?.[0] : (Array.isArray(tplan) ? tplan[0] : ''),
      alternative: Array.isArray(tplan?.plan) ? tplan.plan?.slice(1) : [],
      urgency: 'routine',
      complexity: 'moderate'
    },
    prognosis: tplan?.prognosis || row.prognosis || '',
    consultation_date: row.consultation_date || new Date().toISOString(),
    last_updated_at: new Date().toISOString()
  }

  return clinical_data
}

function safeParse(jsonMaybe: any) {
  if (!jsonMaybe) return null
  if (typeof jsonMaybe !== 'string') return jsonMaybe
  try { return JSON.parse(jsonMaybe) } catch { return null }
}

// Migrates legacy consultations (without clinical_data) into JSONB structure
export async function migrateLegacyConsultationsAction(limit: number = 200) {
  const supabase = await createServiceClient()

  // Try a small sample each run
  const { data: rows, error } = await supabase
    .schema('api')
    .from('consultations')
    .select('*')
    .is('clinical_data', null)
    .order('consultation_date', { ascending: false })
    .limit(limit)

  if (error) {
    return { success: false, error: `Failed to load consultations: ${error.message}` }
  }

  if (!rows || rows.length === 0) {
    return { success: true, migrated: 0 }
  }

  let migrated = 0
  for (const row of rows) {
    try {
      const clinical_data = buildClinicalDataFromLegacy(row)
      const updatePayload: any = { clinical_data, updated_at: new Date().toISOString() }
      if (clinical_data.chief_complaint) updatePayload.chief_complaint = clinical_data.chief_complaint

      const { error: upErr } = await supabase
        .schema('api')
        .from('consultations')
        .update(updatePayload)
        .eq('id', row.id)

      if (!upErr) migrated++
    } catch (e) {
      // continue
    }
  }

  revalidatePath('/dentist')
  return { success: true, migrated }
}