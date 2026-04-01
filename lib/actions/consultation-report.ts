'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { generateConsultationReport, type ReportData } from '@/lib/services/report-generator'

/**
 * Generate a PDF report for a completed consultation.
 * Returns the PDF as a base64 string for client-side download.
 */
export async function generateConsultationReportAction(params: {
  consultationId: string
  includeTranscript?: boolean
}): Promise<{
  success: boolean
  pdfBase64?: string
  fileName?: string
  error?: string
}> {
  try {
    const supabase = await createServiceClient()
    const authClient = await createClient()

    // Verify user is authenticated
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) {
      return { success: false, error: 'Authentication required' }
    }

    // 1. Fetch consultation data
    const { data: consultation, error: cErr } = await supabase
      .schema('api')
      .from('consultations')
      .select('*')
      .eq('id', params.consultationId)
      .single()

    if (cErr || !consultation) {
      return { success: false, error: 'Consultation not found' }
    }

    // 2. Fetch patient data
    const { data: patient } = await supabase
      .from('patients')
      .select('id, first_name, last_name, date_of_birth, gender, phone')
      .eq('id', consultation.patient_id)
      .single()

    // 3. Fetch dentist profile
    const { data: dentistProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', consultation.dentist_id)
      .single()

    // 4. Fetch tooth diagnoses for this consultation
    const { data: toothDx } = await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .select('tooth_number, primary_diagnosis, recommended_treatment, status, treatment_priority')
      .eq('consultation_id', params.consultationId)
      .order('tooth_number')

    // 5. Parse clinical data from the consultation's JSON fields
    const clinicalData = consultation.clinical_data || {}
    const chiefComplaintSection = clinicalData['chief-complaint'] || clinicalData['chiefComplaint'] || {}
    const hopiSection = clinicalData['hopi'] || clinicalData['history-of-present-illness'] || {}
    const medicalHxSection = clinicalData['medical-history'] || clinicalData['medicalHistory'] || {}
    const examSection = clinicalData['clinical-examination'] || clinicalData['clinicalExamination'] || {}
    const investigationsSection = clinicalData['investigations'] || {}
    const diagnosisSection = clinicalData['clinical-diagnosis'] || clinicalData['diagnosis'] || {}
    const treatmentSection = clinicalData['treatment-plan'] || clinicalData['treatmentPlan'] || {}
    const prescriptionSection = clinicalData['prescription'] || {}
    const followUpSection = clinicalData['follow-up'] || clinicalData['followUp'] || {}

    // 6. Compute patient age
    let age: number | undefined
    if (patient?.date_of_birth) {
      const dob = new Date(patient.date_of_birth)
      const today = new Date()
      age = today.getFullYear() - dob.getFullYear()
      const monthDiff = today.getMonth() - dob.getMonth()
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--
    }

    // 7. Extract prescriptions array
    const prescriptions: ReportData['prescriptions'] = []
    const rxData = prescriptionSection.medications || prescriptionSection.prescriptions || []
    if (Array.isArray(rxData)) {
      for (const rx of rxData) {
        prescriptions.push({
          name: rx.name || rx.medication || 'Unknown',
          dosage: rx.dosage || rx.dose || '',
          frequency: rx.frequency || '',
          duration: rx.duration || '',
          instructions: rx.instructions || rx.notes || '',
        })
      }
    }

    // 8. Summarize clinical sections into readable strings
    const summarize = (obj: any): string => {
      if (!obj || typeof obj !== 'object') return obj || ''
      const parts: string[] = []
      for (const [key, val] of Object.entries(obj)) {
        if (key === 'medications' || key === 'prescriptions' || key === 'appointments') continue
        if (typeof val === 'string' && val.trim()) {
          parts.push(`${key.replace(/_/g, ' ')}: ${val}`)
        } else if (typeof val === 'boolean' && val) {
          parts.push(key.replace(/_/g, ' '))
        } else if (Array.isArray(val) && val.length > 0) {
          parts.push(`${key.replace(/_/g, ' ')}: ${val.join(', ')}`)
        }
      }
      return parts.join('; ') || ''
    }

    // 9. Build report data
    const reportData: ReportData = {
      patient: {
        name: patient ? `${patient.first_name} ${patient.last_name}` : 'Unknown Patient',
        age,
        gender: patient?.gender || undefined,
        phone: patient?.phone || undefined,
      },
      consultation: {
        id: params.consultationId,
        date: consultation.consultation_date
          ? new Date(consultation.consultation_date).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
          : new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }),
        mode: consultation.consultation_mode || 'new_consultation',
        dentistName: dentistProfile?.full_name || 'Dr. Unknown',
        clinicName: 'EndoFlow Dental Clinic',
      },
      clinicalData: {
        chiefComplaint: consultation.chief_complaint || summarize(chiefComplaintSection) || undefined,
        hpiSummary: summarize(hopiSection) || undefined,
        medicalHistory: summarize(medicalHxSection) || undefined,
        clinicalExamination: summarize(examSection) || undefined,
        investigations: summarize(investigationsSection) || undefined,
      },
      aiDiagnosis: (consultation.diagnosis || diagnosisSection) ? {
        primaryDiagnosis: consultation.diagnosis || diagnosisSection.primary_diagnosis || summarize(diagnosisSection) || undefined,
        treatmentPlan: consultation.treatment_plan || summarize(treatmentSection) || undefined,
        prognosis: diagnosisSection.prognosis || treatmentSection.prognosis || undefined,
        differentials: diagnosisSection.differentials || diagnosisSection.differential_diagnoses || undefined,
        confidence: diagnosisSection.confidence || undefined,
        evidenceCitations: diagnosisSection.citations || diagnosisSection.references || undefined,
      } : undefined,
      toothFindings: (toothDx || []).map(td => ({
        toothNumber: td.tooth_number,
        diagnosis: td.primary_diagnosis || '-',
        treatment: td.recommended_treatment || '-',
        status: td.status || 'attention',
        priority: td.treatment_priority || 'medium',
      })),
      prescriptions,
      followUp: followUpSection ? {
        plan: summarize(followUpSection) || undefined,
        nextAppointmentDate: followUpSection.next_appointment_date || followUpSection.nextDate || undefined,
        instructions: followUpSection.patient_instructions || followUpSection.instructions || undefined,
      } : undefined,
      transcript: params.includeTranscript ? (consultation.voice_transcript || consultation.transcript || undefined) : undefined,
    }

    // 9b. Session 12: Fetch clinical images if available
    const imageRefs = consultation.image_references
    if (imageRefs && Array.isArray(imageRefs) && imageRefs.length > 0) {
      console.log(`🖼️ [REPORT] Fetching ${imageRefs.length} clinical images...`)
      const clinicalImages: ReportData['clinicalImages'] = []

      for (const fileId of imageRefs) {
        try {
          // Fetch file metadata
          const { data: fileRecord } = await supabase
            .schema('api')
            .from('patient_files')
            .select('file_path, file_type, description, mime_type')
            .eq('id', fileId)
            .single()

          if (fileRecord) {
            // Get signed URL
            const { data: urlData } = await supabase.storage
              .from('medical-files')
              .createSignedUrl(fileRecord.file_path, 3600)

            if (urlData?.signedUrl) {
              clinicalImages.push({
                url: urlData.signedUrl,
                type: fileRecord.file_type || 'Clinical Image',
                description: fileRecord.description || '',
                mimeType: fileRecord.mime_type || 'image/jpeg',
              })
            }
          }
        } catch (imgErr) {
          console.warn(`⚠️ [REPORT] Failed to fetch image ${fileId}:`, imgErr)
        }
      }

      if (clinicalImages.length > 0) {
        reportData.clinicalImages = clinicalImages
        console.log(`✅ [REPORT] ${clinicalImages.length} images ready for embedding`)
      }
    }

    // 10. Generate PDF
    console.log('📄 [REPORT] Generating PDF for consultation:', params.consultationId)
    const pdfBytes = await generateConsultationReport(reportData)

    // 11. Convert to base64 for client download
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64')

    const patientName = reportData.patient.name.replace(/\s+/g, '_')
    const dateStr = new Date().toISOString().split('T')[0]
    const fileName = `EndoFlow_Report_${patientName}_${dateStr}.pdf`

    console.log(`✅ [REPORT] Generated ${fileName} (${Math.round(pdfBytes.length / 1024)}KB)`)

    return {
      success: true,
      pdfBase64,
      fileName,
    }

  } catch (err: any) {
    console.error('❌ [REPORT] Error generating report:', err)
    return { success: false, error: err.message || 'Failed to generate report' }
  }
}

/**
 * Save the report PDF to Supabase Storage and link it to the patient's profile.
 */
export async function saveReportToProfileAction(params: {
  consultationId: string
  patientId: string
  pdfBase64: string
  fileName: string
}): Promise<{ success: boolean; filePath?: string; error?: string }> {
  try {
    const supabase = await createServiceClient()
    const authClient = await createClient()

    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return { success: false, error: 'Authentication required' }

    // Convert base64 to buffer
    const pdfBuffer = Buffer.from(params.pdfBase64, 'base64')
    const storagePath = `patient-reports/${params.patientId}/${params.fileName}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('medical-files')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) {
      console.error('❌ [REPORT] Storage upload failed:', uploadError)
      return { success: false, error: 'Failed to upload report to storage' }
    }

    // Save metadata to patient_files table
    await supabase
      .schema('api')
      .from('patient_files')
      .insert({
        patient_id: params.patientId,
        uploaded_by: user.id,
        file_name: params.fileName,
        original_file_name: params.fileName,
        file_path: storagePath,
        file_size: pdfBuffer.length,
        mime_type: 'application/pdf',
        file_type: 'Consultation Report',
        description: `Consultation report generated on ${new Date().toLocaleDateString()}`,
      })

    console.log(`✅ [REPORT] Saved to profile: ${storagePath}`)

    return { success: true, filePath: storagePath }

  } catch (err: any) {
    console.error('❌ [REPORT] Error saving report:', err)
    return { success: false, error: err.message }
  }
}
