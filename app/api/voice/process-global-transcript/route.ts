import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { analyzeMedicalConversation } from '@/lib/services/medical-conversation-parser'

// This endpoint processes the global voice recording and distributes content to appropriate tabs
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const transcript = formData.get('transcript') as string
    const consultationId = formData.get('consultationId') as string
    const sessionId = formData.get('sessionId') as string
    const audioFile = formData.get('audio') as File

    if (!transcript || !consultationId) {
      return NextResponse.json(
        { error: 'Transcript and consultation ID are required' },
        { status: 400 }
      )
    }

    console.log(`🤖 [GLOBAL VOICE] Processing transcript for consultation: ${consultationId}`)

    // Process transcript using AI to categorize content
    const processedContent = await processTranscriptWithAI(transcript)

    // Update consultation with processed data
    const supabase = await createServiceClient()

    const { error: updateError } = await supabase
      .schema('api')
      .from('consultations')
      .update({
        global_voice_transcript: transcript,
        global_voice_processed_data: JSON.stringify(processedContent),
        voice_recording_duration: calculateDuration(transcript),
        updated_at: new Date().toISOString()
      })
      .eq('id', consultationId)

    if (updateError) {
      console.error('❌ [GLOBAL VOICE] Failed to update consultation:', updateError)
      return NextResponse.json(
        { error: 'Failed to save processed content' },
        { status: 500 }
      )
    }

    // Send to N8N for further processing (optional)
    if (process.env.N8N_WEBHOOK_URL) {
      await sendToN8N(transcript, consultationId, sessionId)
    }

    console.log(`✅ [GLOBAL VOICE] Successfully processed and saved transcript`)

    return NextResponse.json({
      success: true,
      processedContent,
      message: 'Global transcript processed successfully'
    })

  } catch (error) {
    console.error('❌ [GLOBAL VOICE] Processing error:', error)
    return NextResponse.json(
      { error: 'Failed to process global transcript' },
      { status: 500 }
    )
  }
}

async function processTranscriptWithAI(transcript: string) {
  console.log('🔍 [GEMINI AI] Analyzing transcript for medical content...')

  try {
    // Use Gemini AI to analyze the medical conversation
    console.log('🚀 [GEMINI AI] Calling medical conversation parser...')
    const geminiAnalysis = await analyzeMedicalConversation(transcript)

    console.log(`✅ [GEMINI AI] Analysis complete with ${geminiAnalysis.confidence}% confidence`)
    console.log('🎯 [GEMINI AI] Extracted Chief Complaint:', geminiAnalysis.chiefComplaint.primary_complaint)
    console.log('🎯 [GEMINI AI] Extracted Pain Quality:', geminiAnalysis.hopi.pain_characteristics.quality)

    // Map Gemini analysis to existing format for backward compatibility
    const processedContent = {
      chiefComplaint: {
        primary_complaint: geminiAnalysis.chiefComplaint.primary_complaint,
        patient_description: geminiAnalysis.chiefComplaint.patient_description,
        pain_scale: geminiAnalysis.chiefComplaint.pain_scale,
        location_detail: geminiAnalysis.chiefComplaint.location_detail,
        onset_duration: geminiAnalysis.chiefComplaint.onset_duration,
        associated_symptoms: geminiAnalysis.chiefComplaint.associated_symptoms || [],
        triggers: geminiAnalysis.chiefComplaint.triggers || [],
        // Additional fields for compatibility
        onset_type: geminiAnalysis.hopi.onset_details.how_started || '',
        severity_scale: geminiAnalysis.chiefComplaint.pain_scale,
        frequency: geminiAnalysis.hopi.pain_characteristics.frequency || '',
        auto_extracted: geminiAnalysis.auto_extracted,
        extraction_timestamp: geminiAnalysis.extraction_timestamp
      },
      hopi: {
        pain_characteristics: geminiAnalysis.hopi.pain_characteristics,
        onset_details: geminiAnalysis.hopi.onset_details,
        aggravating_factors: geminiAnalysis.hopi.aggravating_factors || [],
        relieving_factors: geminiAnalysis.hopi.relieving_factors || [],
        associated_symptoms: geminiAnalysis.hopi.associated_symptoms || [],
        previous_episodes: geminiAnalysis.hopi.previous_episodes || '',
        pattern_changes: geminiAnalysis.hopi.pattern_changes || '',
        // Additional fields for compatibility
        previous_treatments: [],
        response_to_treatment: '',
        chronology: geminiAnalysis.hopi.onset_details.when_started || '',
        impact_on_daily_life: [],
        auto_extracted: geminiAnalysis.auto_extracted,
        extraction_timestamp: geminiAnalysis.extraction_timestamp
      },
      // Placeholder for other sections (can be extracted later if needed)
      medicalHistory: extractMedicalHistory(transcript.toLowerCase()),
      personalHistory: extractPersonalHistory(transcript.toLowerCase()),
      clinicalExamination: extractClinicalExamination(transcript.toLowerCase()),
      investigations: extractInvestigations(transcript.toLowerCase()),
      diagnosis: extractDiagnosis(transcript.toLowerCase()),
      treatmentPlan: extractTreatmentPlan(transcript.toLowerCase()),
      // Overall confidence from Gemini
      confidence: geminiAnalysis.confidence
    }

    return processedContent

  } catch (error) {
    console.error('❌ [GEMINI AI] Analysis failed, using keyword extraction fallback:', error)

    // Fallback to basic keyword extraction if Gemini fails
    const lowerTranscript = transcript.toLowerCase()

    const fallbackContent = {
      chiefComplaint: extractChiefComplaint(lowerTranscript),
      hopi: extractHOPI(lowerTranscript),
      medicalHistory: extractMedicalHistory(lowerTranscript),
      personalHistory: extractPersonalHistory(lowerTranscript),
      clinicalExamination: extractClinicalExamination(lowerTranscript),
      investigations: extractInvestigations(lowerTranscript),
      diagnosis: extractDiagnosis(lowerTranscript),
      treatmentPlan: extractTreatmentPlan(lowerTranscript),
      confidence: calculateConfidence({
        chiefComplaint: extractChiefComplaint(lowerTranscript),
        hopi: extractHOPI(lowerTranscript),
        medicalHistory: extractMedicalHistory(lowerTranscript),
        personalHistory: extractPersonalHistory(lowerTranscript),
        clinicalExamination: extractClinicalExamination(lowerTranscript),
        investigations: extractInvestigations(lowerTranscript),
        diagnosis: extractDiagnosis(lowerTranscript),
        treatmentPlan: extractTreatmentPlan(lowerTranscript)
      })
    }

    console.log(`⚠️ [FALLBACK] Using keyword extraction with ${fallbackContent.confidence}% confidence`)
    return fallbackContent
  }
}

function extractChiefComplaint(transcript: string) {
  const keywords = [
    'chief complaint', 'main problem', 'primary concern', 'patient complains',
    'presents with', 'came in for', 'tooth pain', 'toothache', 'dental pain'
  ]

  let content = {}

  // Look for chief complaint indicators
  for (const keyword of keywords) {
    const index = transcript.indexOf(keyword)
    if (index !== -1) {
      // Extract surrounding context (next 100 characters)
      const context = transcript.substring(index, index + 100)

      content = {
        primary_complaint: extractComplaintFromContext(context),
        patient_description: context.trim(),
        auto_extracted: true
      }
      break
    }
  }

  // Extract pain intensity if mentioned
  const painMatch = transcript.match(/pain.*?(\d+).*?(?:out of|\/)\s*10/i)
  if (painMatch) {
    content = { ...content, pain_scale: parseInt(painMatch[1]) }
  }

  return content
}

function extractHOPI(transcript: string) {
  const painKeywords = ['sharp', 'dull', 'throbbing', 'aching', 'burning', 'shooting']
  const durationKeywords = ['hours', 'days', 'weeks', 'months', 'yesterday', 'last week']
  const triggerKeywords = ['cold', 'hot', 'sweet', 'pressure', 'chewing', 'biting']

  let content = {
    pain_characteristics: {},
    aggravating_factors: [],
    relieving_factors: [],
    associated_symptoms: []
  }

  // Extract pain quality
  for (const quality of painKeywords) {
    if (transcript.includes(quality)) {
      content.pain_characteristics = { ...content.pain_characteristics, quality }
      break
    }
  }

  // Extract duration
  for (const duration of durationKeywords) {
    if (transcript.includes(duration)) {
      const index = transcript.indexOf(duration)
      const context = transcript.substring(Math.max(0, index - 20), index + 20)
      content.pain_characteristics = { ...content.pain_characteristics, duration: context.trim() }
      break
    }
  }

  // Extract triggers
  for (const trigger of triggerKeywords) {
    if (transcript.includes(trigger)) {
      content.aggravating_factors.push(trigger)
    }
  }

  return content
}

function extractMedicalHistory(transcript: string) {
  const conditions = [
    'diabetes', 'hypertension', 'high blood pressure', 'heart disease', 'asthma',
    'thyroid', 'kidney', 'liver', 'cancer', 'arthritis', 'allergic'
  ]

  const medications = [
    'medication', 'medicine', 'pill', 'tablet', 'insulin', 'blood thinner',
    'aspirin', 'ibuprofen', 'antibiotic'
  ]

  let content = {
    medical_conditions: [],
    current_medications: [],
    allergies: []
  }

  // Extract medical conditions
  for (const condition of conditions) {
    if (transcript.includes(condition)) {
      content.medical_conditions.push({
        condition: condition,
        status: 'current',
        auto_extracted: true
      })
    }
  }

  // Extract medications
  for (const medication of medications) {
    if (transcript.includes(medication)) {
      const index = transcript.indexOf(medication)
      const context = transcript.substring(index, index + 50)
      content.current_medications.push({
        name: context.trim(),
        auto_extracted: true
      })
    }
  }

  // Extract allergies
  if (transcript.includes('allergic') || transcript.includes('allergy')) {
    const allergyMatch = transcript.match(/allergic to ([\w\s]+)/i)
    if (allergyMatch) {
      content.allergies.push({
        allergen: allergyMatch[1].trim(),
        auto_extracted: true
      })
    }
  }

  return content
}

function extractPersonalHistory(transcript: string) {
  let content = {
    smoking: { status: 'never' },
    alcohol: { status: 'never' },
    tobacco: { status: 'never' }
  }

  // Smoking detection
  if (transcript.includes('smoke') || transcript.includes('cigarette')) {
    content.smoking = { status: 'current', auto_extracted: true }
  }

  // Alcohol detection
  if (transcript.includes('drink') || transcript.includes('alcohol')) {
    content.alcohol = { status: 'regular', auto_extracted: true }
  }

  // Tobacco detection
  if (transcript.includes('tobacco') || transcript.includes('chew')) {
    content.tobacco = { status: 'current', auto_extracted: true }
  }

  return content
}

function extractClinicalExamination(transcript: string) {
  const extraoralKeywords = ['facial', 'symmetry', 'swelling', 'lymph node', 'tmj']
  const intraoralKeywords = ['gums', 'gingiva', 'teeth', 'tongue', 'palate', 'oral hygiene']

  let content = {
    extraoral_findings: {},
    intraoral_findings: {}
  }

  // Extract extraoral findings
  for (const keyword of extraoralKeywords) {
    if (transcript.includes(keyword)) {
      const index = transcript.indexOf(keyword)
      const context = transcript.substring(index, index + 100)
      content.extraoral_findings = {
        ...content.extraoral_findings,
        [keyword.replace(' ', '_')]: context.trim(),
        auto_extracted: true
      }
    }
  }

  // Extract intraoral findings
  for (const keyword of intraoralKeywords) {
    if (transcript.includes(keyword)) {
      const index = transcript.indexOf(keyword)
      const context = transcript.substring(index, index + 100)
      content.intraoral_findings = {
        ...content.intraoral_findings,
        [keyword.replace(' ', '_')]: context.trim(),
        auto_extracted: true
      }
    }
  }

  return content
}

function extractInvestigations(transcript: string) {
  const radiographicKeywords = ['x-ray', 'radiograph', 'cbct', 'panoramic', 'opg']
  const testKeywords = ['vitality test', 'percussion', 'palpation', 'mobility']

  let content = {
    radiographic: { type: [], findings: '' },
    clinical_tests: {}
  }

  // Extract radiographic investigations
  for (const keyword of radiographicKeywords) {
    if (transcript.includes(keyword)) {
      content.radiographic.type.push(keyword)
      const index = transcript.indexOf(keyword)
      const context = transcript.substring(index, index + 150)
      content.radiographic.findings += context.trim() + ' '
    }
  }

  // Extract clinical tests
  for (const test of testKeywords) {
    if (transcript.includes(test)) {
      const index = transcript.indexOf(test)
      const context = transcript.substring(index, index + 100)
      content.clinical_tests = {
        ...content.clinical_tests,
        [test.replace(' ', '_')]: context.trim()
      }
    }
  }

  return content
}

function extractDiagnosis(transcript: string) {
  const diagnosisKeywords = [
    'diagnosis', 'caries', 'pulpitis', 'periodontitis', 'abscess',
    'fracture', 'impaction', 'gingivitis'
  ]

  let content = {
    provisional_diagnosis: [],
    differential_diagnosis: []
  }

  for (const diagnosis of diagnosisKeywords) {
    if (transcript.includes(diagnosis)) {
      content.provisional_diagnosis.push({
        diagnosis: diagnosis,
        auto_extracted: true
      })
    }
  }

  return content
}

function extractTreatmentPlan(transcript: string) {
  const treatmentKeywords = [
    'filling', 'extraction', 'root canal', 'crown', 'cleaning',
    'scaling', 'polishing', 'surgery', 'implant'
  ]

  let content = {
    procedures: [],
    recommendations: ''
  }

  for (const treatment of treatmentKeywords) {
    if (transcript.includes(treatment)) {
      content.procedures.push({
        procedure: treatment,
        auto_extracted: true
      })
    }
  }

  return content
}

function extractComplaintFromContext(context: string): string {
  // Extract the main complaint from the context
  const words = context.split(' ')
  const stopWords = ['the', 'a', 'an', 'is', 'was', 'has', 'have', 'of']
  const relevantWords = words.filter(word =>
    word.length > 2 && !stopWords.includes(word.toLowerCase())
  )

  return relevantWords.slice(0, 5).join(' ')
}

function calculateConfidence(content: any): number {
  let score = 0
  let maxScore = 0

  // Calculate confidence based on how much content was extracted
  const sections = Object.keys(content)
  for (const section of sections) {
    if (section === 'confidence') continue

    maxScore += 10
    const sectionContent = content[section]

    if (sectionContent && typeof sectionContent === 'object') {
      const keys = Object.keys(sectionContent)
      if (keys.length > 0) {
        score += Math.min(10, keys.length * 2)
      }
    }
  }

  return Math.round((score / maxScore) * 100)
}

function calculateDuration(transcript: string): number {
  // Estimate duration based on transcript length (average speaking rate)
  const wordsPerMinute = 150
  const wordCount = transcript.split(' ').length
  return Math.round((wordCount / wordsPerMinute) * 60) // return seconds
}

async function sendToN8N(transcript: string, consultationId: string, sessionId: string) {
  try {
    const webhookUrl = process.env.N8N_WEBHOOK_URL
    if (!webhookUrl) return

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript,
        consultationId,
        sessionId,
        timestamp: new Date().toISOString(),
        type: 'global_consultation_recording'
      })
    })

    if (response.ok) {
      console.log('✅ [N8N] Sent transcript to N8N successfully')
    } else {
      console.error('❌ [N8N] Failed to send to N8N:', response.status)
    }
  } catch (error) {
    console.error('❌ [N8N] Error sending to N8N:', error)
  }
}