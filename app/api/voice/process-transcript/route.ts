import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// This endpoint will be called by N8N after processing the voice transcript
export async function POST(request: NextRequest) {
  try {
    const { sessionId, processedData, confidence, error: processingError } = await request.json()

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createServiceClient()

    console.log(`🤖 [AI] Processing voice session: ${sessionId}`)

    // Update voice session with processed data
    const updateData: any = {
      status: processingError ? 'failed' : 'completed',
      processed_data: JSON.stringify(processedData || {}),
      ai_confidence: JSON.stringify(confidence || {}),
      updated_at: new Date().toISOString()
    }

    if (processingError) {
      updateData.error_message = processingError
      updateData.retry_count = supabase.raw('retry_count + 1')
    }

    const { data: session, error } = await supabase
      .schema('api')
      .from('voice_sessions')
      .update(updateData)
      .eq('id', sessionId)
      .select(`
        id,
        consultation_id,
        processed_data,
        ai_confidence
      `)
      .single()

    if (error) {
      console.error('❌ [AI] Failed to update voice session:', error)
      return NextResponse.json(
        { error: 'Failed to update voice session' },
        { status: 500 }
      )
    }

    // If processing was successful, update the consultation with extracted data
    if (!processingError && processedData && session) {
      await updateConsultationWithAIData(session.consultation_id, processedData)
    }

    console.log(`✅ [AI] Voice session processed successfully`)

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      message: 'Voice transcript processed successfully'
    })

  } catch (error) {
    console.error('Voice processing API error:', error)
    return NextResponse.json(
      { error: 'Failed to process voice transcript' },
      { status: 500 }
    )
  }
}

async function updateConsultationWithAIData(consultationId: string, processedData: any) {
  try {
    const supabase = await createServiceClient()

    console.log(`🔄 [AI] Updating consultation ${consultationId} with AI-processed data`)

    // Get current consultation data
    const { data: consultation, error: fetchError } = await supabase
      .schema('api')
      .from('consultations')
      .select('*')
      .eq('id', consultationId)
      .single()

    if (fetchError || !consultation) {
      console.error('❌ [AI] Failed to fetch consultation:', fetchError)
      return
    }

    // Merge AI-processed data with existing consultation data
    const updateFields: any = {}

    // Pain Assessment
    if (processedData.pain_assessment) {
      const currentPainData = consultation.pain_assessment ? JSON.parse(consultation.pain_assessment) : {}
      const mergedPainData = { ...currentPainData, ...processedData.pain_assessment }
      updateFields.pain_assessment = JSON.stringify(mergedPainData)
    }

    // Clinical Examination
    if (processedData.clinical_examination) {
      const currentExamData = consultation.clinical_examination ? JSON.parse(consultation.clinical_examination) : {}
      const mergedExamData = { ...currentExamData, ...processedData.clinical_examination }
      updateFields.clinical_examination = JSON.stringify(mergedExamData)
    }

    // Investigations
    if (processedData.investigations) {
      const currentInvestigationData = consultation.investigations ? JSON.parse(consultation.investigations) : {}
      const mergedInvestigationData = { ...currentInvestigationData, ...processedData.investigations }
      updateFields.investigations = JSON.stringify(mergedInvestigationData)
    }

    // Diagnosis
    if (processedData.diagnosis) {
      const currentDiagnosisData = consultation.diagnosis ? JSON.parse(consultation.diagnosis) : {}
      const mergedDiagnosisData = { ...currentDiagnosisData, ...processedData.diagnosis }
      updateFields.diagnosis = JSON.stringify(mergedDiagnosisData)
    }

    // Treatment Plan
    if (processedData.treatment_plan) {
      const currentTreatmentData = consultation.treatment_plan ? JSON.parse(consultation.treatment_plan) : {}
      const mergedTreatmentData = { ...currentTreatmentData, ...processedData.treatment_plan }
      updateFields.treatment_plan = JSON.stringify(mergedTreatmentData)
    }

    // Chief Complaint (if extracted from voice)
    if (processedData.chief_complaint && !consultation.chief_complaint) {
      updateFields.chief_complaint = processedData.chief_complaint
    }

    // Update consultation if there are changes
    if (Object.keys(updateFields).length > 0) {
      updateFields.updated_at = new Date().toISOString()

      const { error: updateError } = await supabase
        .schema('api')
        .from('consultations')
        .update(updateFields)
        .eq('id', consultationId)

      if (updateError) {
        console.error('❌ [AI] Failed to update consultation:', updateError)
      } else {
        console.log(`✅ [AI] Consultation updated with AI data`)
      }
    }

  } catch (error) {
    console.error('❌ [AI] Error updating consultation with AI data:', error)
  }
}

// Webhook endpoint for N8N to send processed data
export async function PUT(request: NextRequest) {
  return POST(request) // Same logic for both POST and PUT
}