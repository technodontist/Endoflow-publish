/**
 * API Route: Save tooth diagnosis from Co-Pilot Accept button
 *
 * Session 18: Created so the copilot sidebar can accept and save
 * a diagnosis without going through server actions (cookies() deadlock).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getStatusColorCode, type ToothStatus } from '@/lib/utils/toothStatus'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      consultationId,
      patientId,
      toothNumber,
      status,
      primaryDiagnosis,
      diagnosisDetails,
      recommendedTreatment,
      treatmentPriority,
      treatmentDetails,
      colorCode,
      endodonticDiagnosis,
      endodonticConfidence,
      restorativeDiagnosis,
      restorativeConfidence,
      combinedTreatmentSequence,
    } = body

    if (!patientId || !toothNumber) {
      return NextResponse.json(
        { success: false, error: 'patientId and toothNumber required' },
        { status: 400 }
      )
    }

    const supabase = await createServiceClient()

    const dbData = {
      consultation_id: consultationId || null,
      patient_id: patientId,
      tooth_number: toothNumber,
      status: status || 'attention',
      primary_diagnosis: primaryDiagnosis || null,
      diagnosis_details: diagnosisDetails || null,
      recommended_treatment: recommendedTreatment || null,
      treatment_priority: treatmentPriority || 'medium',
      treatment_details: treatmentDetails || null,
      color_code: colorCode || getStatusColorCode((status || 'attention') as ToothStatus),
      follow_up_required: false,
      examination_date: new Date().toISOString().split('T')[0],
      endodontic_diagnosis: endodonticDiagnosis || null,
      endodontic_confidence: endodonticConfidence || null,
      restorative_diagnosis: restorativeDiagnosis || null,
      restorative_confidence: restorativeConfidence || null,
      combined_treatment_sequence: combinedTreatmentSequence || null,
    }

    // Upsert — update if diagnosis for this patient+tooth exists, insert otherwise
    const { data: existing } = await supabase
      .from('tooth_diagnoses')
      .select('id')
      .eq('patient_id', patientId)
      .eq('tooth_number', toothNumber)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    let result
    if (existing?.id) {
      result = await supabase
        .from('tooth_diagnoses')
        .update(dbData)
        .eq('id', existing.id)
        .select()
        .single()
    } else {
      result = await supabase
        .from('tooth_diagnoses')
        .insert(dbData)
        .select()
        .single()
    }

    if (result.error) {
      console.error('❌ [API] Failed to save tooth diagnosis:', result.error.message)
      return NextResponse.json(
        { success: false, error: result.error.message },
        { status: 500 }
      )
    }

    console.log(`💾 [API] Tooth diagnosis saved for tooth #${toothNumber}`)
    return NextResponse.json({ success: true, data: result.data })
  } catch (err) {
    console.error('❌ [API] Error saving tooth diagnosis:', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
