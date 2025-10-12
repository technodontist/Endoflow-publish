import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { analyzeMedicalConversation } from '@/lib/services/medical-conversation-parser'
import type { ToothDiagnosisData } from '@/lib/actions/tooth-diagnoses'

// This endpoint processes the global voice recording and distributes content to appropriate tabs
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const transcript = formData.get('transcript') as string
    const consultationId = formData.get('consultationId') as string
    const sessionId = formData.get('sessionId') as string
    const audioFile = formData.get('audio') as File
    const language = (formData.get('language') as string) || 'en-US' // Default to English

    if (!transcript || !consultationId) {
      return NextResponse.json(
        { error: 'Transcript and consultation ID are required' },
        { status: 400 }
      )
    }

    console.log(`🤖 [GLOBAL VOICE] Processing transcript for consultation: ${consultationId}`)
    console.log(`🌐 [GLOBAL VOICE] Language: ${language}`)

    // Process transcript using AI to categorize content
    const processedContent = await processTranscriptWithAI(transcript, language)

    // Update consultation with processed data
    const supabase = await createServiceClient()

    // Extract tooth-specific diagnoses (but don't save yet - only save when consultation is saved)
    const toothDiagnoses = await extractToothDiagnosesFromTranscript(transcript, consultationId, processedContent, language)

    // Prepare update data - only include new fields if columns exist (graceful degradation)
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    // Try to update new voice fields, but don't fail if columns don't exist yet
    try {
      // Check if the new columns exist by attempting to update them
      const { error: updateError } = await supabase
        .schema('api')
        .from('consultations')
        .update({
          global_voice_transcript: transcript,
          global_voice_processed_data: JSON.stringify(processedContent),
          voice_recording_duration: calculateDuration(transcript),
          voice_extracted_tooth_diagnoses: JSON.stringify(toothDiagnoses),
          updated_at: new Date().toISOString()
        })
        .eq('id', consultationId)

      if (updateError) {
        // Check if error is due to missing columns
        if (updateError.message?.includes('column') || updateError.code === '42703') {
          console.warn('⚠️ [GLOBAL VOICE] New voice columns not yet migrated, using legacy fields only')
          // Fallback to updating only existing fields
          const { error: fallbackError } = await supabase
            .schema('api')
            .from('consultations')
            .update({
              updated_at: new Date().toISOString()
            })
            .eq('id', consultationId)

          if (fallbackError) {
            throw fallbackError
          }
        } else {
          throw updateError
        }
      }
    } catch (error) {
      console.error('❌ [GLOBAL VOICE] Failed to update consultation:', error)
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
    console.log(`🦷 [GLOBAL VOICE] Extracted ${toothDiagnoses.length} voice-extracted tooth diagnoses`)

    return NextResponse.json({
      success: true,
      processedContent,
      toothDiagnoses,
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

async function processTranscriptWithAI(transcript: string, language: string = 'en-US') {
  console.log('🔍 [GEMINI AI] Analyzing transcript for medical content...')
  console.log(`🌐 [GEMINI AI] Input language: ${language}`)

  try {
    // Use Gemini AI to analyze the medical conversation
    console.log('🚀 [GEMINI AI] Calling medical conversation parser...')
    const geminiAnalysis = await analyzeMedicalConversation(transcript, language)

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
      // Use AI-extracted data if available, otherwise fallback to keyword extraction
      medicalHistory: geminiAnalysis.medicalHistory || extractMedicalHistory(transcript.toLowerCase()),
      personalHistory: geminiAnalysis.personalHistory || extractPersonalHistory(transcript.toLowerCase()),
      clinicalExamination: geminiAnalysis.clinicalExamination || extractClinicalExamination(transcript.toLowerCase()),
      investigations: extractInvestigations(transcript.toLowerCase()),
      diagnosis: extractDiagnosis(transcript.toLowerCase()),
      treatmentPlan: extractTreatmentPlan(transcript.toLowerCase()),
      // Overall confidence from Gemini
      confidence: geminiAnalysis.confidence
    }
    
    // Log what was extracted
    if (geminiAnalysis.medicalHistory) {
      console.log('✅ [AI EXTRACTION] Medical History extracted from voice')
    }
    if (geminiAnalysis.personalHistory) {
      console.log('✅ [AI EXTRACTION] Personal History extracted from voice')
    }
    if (geminiAnalysis.clinicalExamination) {
      console.log('✅ [AI EXTRACTION] Clinical Examination extracted from voice')
    }

    return processedContent

  } catch (error) {
    console.error('❌ [GEMINI AI] Primary analysis failed, using simplified Gemini fallback:', error)

    // Try simplified Gemini extraction as fallback
    try {
      console.log('🔄 [FALLBACK] Attempting simplified AI extraction...')
      const simplifiedAnalysis = await analyzeMedicalConversation(transcript)
      
      // Mark as lower confidence since it's fallback
      const fallbackContent = {
        chiefComplaint: simplifiedAnalysis.chiefComplaint,
        hopi: simplifiedAnalysis.hopi,
        medicalHistory: extractMedicalHistory(transcript.toLowerCase()),
        personalHistory: extractPersonalHistory(transcript.toLowerCase()),
        clinicalExamination: extractClinicalExamination(transcript.toLowerCase()),
        investigations: extractInvestigations(transcript.toLowerCase()),
        diagnosis: extractDiagnosis(transcript.toLowerCase()),
        treatmentPlan: extractTreatmentPlan(transcript.toLowerCase()),
        confidence: Math.max(30, simplifiedAnalysis.confidence - 20) // Reduce confidence for fallback
      }

      console.log(`✅ [FALLBACK] Simplified AI extraction succeeded with ${fallbackContent.confidence}% confidence`)
      return fallbackContent
      
    } catch (fallbackError) {
      console.error('❌ [FALLBACK] Simplified AI also failed, using basic keyword extraction:', fallbackError)
      
      // Last resort: basic keyword extraction
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
        confidence: 25 // Very low confidence for keyword extraction
      }

      console.log(`⚠️ [FALLBACK] Using basic keyword extraction with ${fallbackContent.confidence}% confidence`)
      return fallbackContent
    }
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
  const treatmentKeywords = ['ibuprofen', 'painkiller', 'antibiotic', 'filling', 'root canal', 'extraction']

  let content = {
    pain_characteristics: {},
    aggravating_factors: [],
    relieving_factors: [],
    associated_symptoms: [],
    previous_treatments: []
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

  // Extract previous treatments
  for (const treatment of treatmentKeywords) {
    if (transcript.includes(treatment)) {
      content.previous_treatments.push(treatment)
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

async function extractToothDiagnosesFromTranscript(
  transcript: string,
  consultationId: string,
  processedContent: any,
  language: string = 'en-US'
) {
  console.log('🦷 [TOOTH EXTRACTION] Starting tooth diagnosis extraction from transcript...')
  console.log('🌐 [TOOTH EXTRACTION] Language:', language)

  try {
    // Get patient ID from consultation
    const supabase = await createServiceClient()
    const { data: consultation, error: consultationError } = await supabase
      .schema('api')
      .from('consultations')
      .select('patient_id')
      .eq('id', consultationId)
      .single()

    if (consultationError || !consultation) {
      console.error('❌ [TOOTH EXTRACTION] Failed to get patient ID:', consultationError)
      return []
    }

    const patientId = consultation.patient_id
    const toothDiagnosesData: any[] = []

    // Pattern to match tooth numbers and their conditions
    // Matches patterns like "tooth 44", "tooth number 44", "#44", "number 44"
    const toothPattern = /(?:tooth\s*(?:number|#)?\s*(\d{1,2})|#(\d{1,2})|number\s+(\d{1,2}))/gi
    const matches = [...transcript.matchAll(toothPattern)]

    for (const match of matches) {
      const toothNumber = match[1] || match[2] || match[3]
      if (!toothNumber) continue

      // Extract context around the tooth mention (100 chars before and after)
      const matchIndex = match.index || 0
      const contextStart = Math.max(0, matchIndex - 100)
      const contextEnd = Math.min(transcript.length, matchIndex + match[0].length + 100)
      const context = transcript.substring(contextStart, contextEnd).toLowerCase()

      console.log(`🦷 [TOOTH EXTRACTION] Found tooth ${toothNumber} with context: "${context}"`)

      // Helper function: Check if context contains any of the keywords in multiple languages
      const containsKeyword = (keywords: string[]) => {
        return keywords.some(kw => context.includes(kw))
      }

      // Multilanguage keyword definitions
      const keywords = {
        caries: ['caries', 'cavity', 'carries', 'कैविटी', 'सड़न'], // Hindi: kaviti, sadan
        deep: ['deep', 'internal', 'गहरा', 'गहरी'], // Hindi: gehra, gehri
        moderate: ['moderate', 'मध्यम'], // Hindi: madhyam
        abscess: ['abscess', 'फोड़ा'], // Hindi: phoda
        pulpitis: ['pulpitis', 'पल्पाइटिस'],
        irreversible: ['irreversible', 'अपरिवर्तनीय'],
        reversible: ['reversible', 'परिवर्तनीय'],
        necrosis: ['necrosis', 'नेक्रोसिस'],
        fracture: ['fracture', 'broken', 'टूटा', 'फ्रैक्चर'], // Hindi: toota, fracture
        pain: ['pain', 'दर्द'], // Hindi: dard
        sharp: ['sharp', 'तेज़'], // Hindi: tez
        dull: ['dull', 'भारी'], // Hindi: bhaari
        throbbing: ['throbbing', 'धड़कन'], // Hindi: dhadkan
        cold: ['cold', 'ice', 'ठंडा'], // Hindi: thanda
        hot: ['hot', 'heat', 'गर्म'], // Hindi: garam
        swelling: ['swelling', 'सूजन'], // Hindi: sujan
        bleeding: ['bleeding', 'खून'], // Hindi: khoon
        sensitive: ['sensitive', 'sensitivity', 'संवेदनशील'] // Hindi: sanvedansheel
      }

      // Determine tooth status and diagnosis from context
      let status: ToothDiagnosisData['status'] = 'healthy'
      let primaryDiagnosis = ''
      let symptoms: string[] = []
      let painCharacteristics: any = {}
      let clinicalFindings = ''
      let recommendedTreatment = ''
      let treatmentPriority: ToothDiagnosisData['treatmentPriority'] = 'medium'

      // Check for various dental conditions (multilanguage support)
      // Use exact diagnosis names matching the predefined options in the dialog
      if (containsKeyword(keywords.caries)) {
        status = 'caries'

        if (containsKeyword(keywords.deep)) {
          primaryDiagnosis = 'Deep Caries'  // Exact match with dialog predefined option
          recommendedTreatment = 'Root Canal Treatment'  // Exact match with dialog predefined option
          treatmentPriority = 'high'
        } else if (containsKeyword(keywords.moderate)) {
          primaryDiagnosis = 'Moderate Caries'
          recommendedTreatment = 'Composite Filling'
          treatmentPriority = 'medium'
        } else if (context.includes('incipient') || context.includes('early')) {
          primaryDiagnosis = 'Incipient Caries'
          recommendedTreatment = 'Fluoride Application'
          treatmentPriority = 'low'
        } else if (context.includes('rampant')) {
          primaryDiagnosis = 'Rampant Caries'
          recommendedTreatment = 'Multiple restorations required'
          treatmentPriority = 'urgent'
        } else if (context.includes('root')) {
          primaryDiagnosis = 'Root Caries'
          recommendedTreatment = 'Composite Filling'
          treatmentPriority = 'medium'
        } else if (context.includes('recurrent') || context.includes('secondary')) {
          primaryDiagnosis = 'Recurrent Caries'
          recommendedTreatment = 'Composite Filling'
          treatmentPriority = 'medium'
        } else {
          primaryDiagnosis = 'Moderate Caries'  // Default to moderate
          recommendedTreatment = 'Composite Filling'
          treatmentPriority = 'medium'
        }
      } else if (containsKeyword(keywords.abscess)) {
        status = 'attention'
        if (context.includes('apical') || context.includes('periapical')) {
          primaryDiagnosis = 'Apical Abscess'  // Exact match
        } else {
          primaryDiagnosis = 'Apical Abscess'
        }
        recommendedTreatment = 'Root Canal Treatment'
        treatmentPriority = 'urgent'
      } else if (containsKeyword(keywords.pulpitis)) {
        status = 'attention'
        if (containsKeyword(keywords.irreversible)) {
          primaryDiagnosis = 'Irreversible Pulpitis'
          recommendedTreatment = 'Root Canal Treatment'
          treatmentPriority = 'high'
        } else if (containsKeyword(keywords.reversible)) {
          primaryDiagnosis = 'Reversible Pulpitis'
          recommendedTreatment = 'Pulp Capping'
          treatmentPriority = 'medium'
        } else {
          primaryDiagnosis = 'Irreversible Pulpitis'
          recommendedTreatment = 'Root Canal Treatment'
          treatmentPriority = 'high'
        }
      } else if (containsKeyword(keywords.necrosis)) {
        status = 'attention'
        primaryDiagnosis = 'Pulp Necrosis'
        recommendedTreatment = 'Root Canal Treatment'
        treatmentPriority = 'urgent'
      } else if (containsKeyword(keywords.fracture)) {
        status = 'attention'
        if (context.includes('crown')) {
          primaryDiagnosis = 'Crown Fracture (Enamel-Dentin)'
          recommendedTreatment = 'Full Crown (Zirconia)'
        } else if (context.includes('root')) {
          primaryDiagnosis = 'Root Fracture'
          recommendedTreatment = 'Extraction'
        } else {
          primaryDiagnosis = 'Crown Fracture (Enamel-Dentin)'
          recommendedTreatment = 'Composite Filling'
        }
        treatmentPriority = 'high'
      } else if (context.includes('extraction') || context.includes('remove')) {
        status = 'extraction_needed'
        primaryDiagnosis = 'Root Fracture'  // Using this as "non-restorable" category
        recommendedTreatment = 'Simple Extraction'
        treatmentPriority = 'high'
      } else if (context.includes('root canal') || context.includes('endodontic')) {
        status = 'root_canal'
        primaryDiagnosis = 'Irreversible Pulpitis'  // Exact match
        recommendedTreatment = 'Root Canal Treatment'
        treatmentPriority = 'high'
      } else if (context.includes('filling') || context.includes('restoration')) {
        status = 'filled'
        if (context.includes('failed') || context.includes('broken')) {
          primaryDiagnosis = 'Failed Restoration'
          recommendedTreatment = 'Composite Filling'
          treatmentPriority = 'medium'
        } else {
          primaryDiagnosis = 'Failed Restoration'
          recommendedTreatment = 'Monitor'
          treatmentPriority = 'routine'
        }
      } else if (context.includes('crown') && !context.includes('fracture')) {
        status = 'crown'
        primaryDiagnosis = 'Failed Restoration'  // Using as proxy for crowned tooth
        recommendedTreatment = 'Monitor'
        treatmentPriority = 'routine'
      } else if (context.includes('missing')) {
        status = 'missing'
        primaryDiagnosis = 'Failed Restoration'  // Using as proxy for missing
        recommendedTreatment = 'Consider implant or bridge'
        treatmentPriority = 'low'
      } else if (context.includes('gingivitis')) {
        status = 'attention'
        primaryDiagnosis = 'Gingivitis'
        recommendedTreatment = 'Scaling & Root Planing'
        treatmentPriority = 'medium'
      } else if (context.includes('periodontitis')) {
        status = 'attention'
        if (context.includes('chronic')) {
          primaryDiagnosis = 'Chronic Periodontitis'
        } else if (context.includes('aggressive')) {
          primaryDiagnosis = 'Aggressive Periodontitis'
        } else {
          primaryDiagnosis = 'Chronic Periodontitis'
        }
        recommendedTreatment = 'Scaling & Root Planing'
        treatmentPriority = 'high'
      } else if (context.includes('hypersensitiv') && (context.includes('diagnos') || context.includes('confirm'))) {
        // Only auto-diagnose hypersensitivity if explicitly stated as diagnosis
        status = 'attention'
        primaryDiagnosis = 'Hypersensitivity'
        recommendedTreatment = 'Fluoride Application'
        treatmentPriority = 'low'
      } else if (containsKeyword(keywords.pain) || containsKeyword(keywords.sensitive) || context.includes('hurt')) {
        // Only extract symptoms, DO NOT auto-diagnose
        status = 'attention'
        primaryDiagnosis = ''  // No auto-diagnosis from symptoms
        symptoms = []

        // Extract detailed pain characteristics (multilanguage)
        if (containsKeyword(keywords.sharp)) symptoms.push('Sharp pain')
        if (containsKeyword(keywords.dull)) symptoms.push('Dull ache')
        if (containsKeyword(keywords.throbbing)) symptoms.push('Throbbing pain')
        if (context.includes('shooting')) symptoms.push('Shooting pain')
        if (context.includes('lingering') || context.includes('linger')) symptoms.push('Lingering pain')
        if (context.includes('spontaneous')) symptoms.push('Spontaneous pain')

        if (containsKeyword(keywords.cold)) symptoms.push('Cold sensitivity')
        if (containsKeyword(keywords.hot)) symptoms.push('Heat sensitivity')
        if (context.includes('sweet')) symptoms.push('Sweet sensitivity')
        if (context.includes('chewing') || context.includes('bite') || context.includes('biting') || context.includes('खाने')) symptoms.push('Pain when chewing')

        // Don't assign diagnosis - let AI Copilot suggest based on symptoms
        recommendedTreatment = 'Further investigation required'
        treatmentPriority = 'high'
      }

      // Extract symptoms from context (if not already added) - multilanguage
      if (containsKeyword(keywords.pain) && !symptoms.some(s => s.toLowerCase().includes('pain'))) symptoms.push('Pain')
      if (containsKeyword(keywords.sensitive) && !symptoms.some(s => s.toLowerCase().includes('sensit'))) symptoms.push('Sensitivity')
      if (containsKeyword(keywords.swelling)) symptoms.push('Swelling')
      if (containsKeyword(keywords.bleeding)) symptoms.push('Bleeding')
      if (context.includes('mobile') || context.includes('loose')) symptoms.push('Mobility')

      // Extract pain characteristics for AI Copilot (multilanguage)
      painCharacteristics = {
        quality: containsKeyword(keywords.sharp) ? 'Sharp' : containsKeyword(keywords.dull) ? 'Dull' : containsKeyword(keywords.throbbing) ? 'Throbbing' : undefined,
        triggers: [
          containsKeyword(keywords.cold) && 'Cold',
          containsKeyword(keywords.hot) && 'Hot',
          (context.includes('chewing') || context.includes('खाने')) && 'Chewing',
          context.includes('sweet') && 'Sweet'
        ].filter(Boolean),
        duration: context.includes('lingering') ? 'Lingering (>30s)' : context.includes('spontaneous') ? 'Spontaneous' : undefined
      }

      // Extract clinical findings from context (multilanguage)
      if (containsKeyword(keywords.deep) && containsKeyword(keywords.caries)) {
        clinicalFindings = 'Deep caries visible on examination'
      } else if (containsKeyword(keywords.swelling)) {
        clinicalFindings = 'Swelling observed'
      } else if (context.includes('visible')) {
        clinicalFindings = context.substring(0, 150)
      }

      // Remove duplicates from symptoms
      symptoms = [...new Set(symptoms)]

      // Save if we found a meaningful diagnosis OR symptoms (for AI Copilot)
      if (primaryDiagnosis || symptoms.length > 0) {
        const toothDiagnosisData: ToothDiagnosisData = {
          consultationId,
          patientId,
          toothNumber,
          status,
          primaryDiagnosis: primaryDiagnosis || undefined,  // undefined if no explicit diagnosis
          diagnosisDetails: primaryDiagnosis ? `Extracted from voice transcript: "${context.substring(0, 200)}"` : undefined,
          symptoms,
          painCharacteristics: Object.keys(painCharacteristics).length > 0 ? painCharacteristics : undefined,
          clinicalFindings: clinicalFindings || undefined,
          recommendedTreatment: recommendedTreatment || undefined,
          treatmentPriority,
          examinationDate: new Date().toISOString().split('T')[0],
          notes: primaryDiagnosis ? 'Auto-extracted from voice recording' : 'Symptoms extracted - awaiting diagnosis'
        }

        console.log(`📋 [TOOTH EXTRACTION] Extracted diagnosis for tooth ${toothNumber}:`, {
          status,
          diagnosis: primaryDiagnosis,
          treatment: recommendedTreatment
        })

        // Add to temporary list (will be saved when consultation is saved)
        toothDiagnosesData.push(toothDiagnosisData)
        console.log(`✅ [TOOTH EXTRACTION] Added tooth ${toothNumber} diagnosis to temporary list`)
      }
    }

    // Also check if chief complaint mentions specific teeth
    if (processedContent?.chiefComplaint?.location_detail) {
      const locationDetail = processedContent.chiefComplaint.location_detail.toLowerCase()
      const toothMentions = locationDetail.match(/\d{1,2}/g)
      
      if (toothMentions && processedContent.chiefComplaint.primary_complaint) {
        for (const toothNum of toothMentions) {
          // Check if we already processed this tooth
          if (!toothDiagnosesData.find(td => td.toothNumber === toothNum)) {
            let status: ToothDiagnosisData['status'] = 'attention'
            const complaint = processedContent.chiefComplaint.primary_complaint.toLowerCase()
            
            if (complaint.includes('caries') || complaint.includes('cavity')) {
              status = 'caries'
            } else if (complaint.includes('pain')) {
              status = 'attention'
            }

            const toothDiagnosisData: ToothDiagnosisData = {
              consultationId,
              patientId,
              toothNumber: toothNum,
              status,
              primaryDiagnosis: processedContent.chiefComplaint.primary_complaint,
              diagnosisDetails: processedContent.chiefComplaint.patient_description,
              symptoms: processedContent.chiefComplaint.associated_symptoms || [],
              treatmentPriority: 'medium',
              examinationDate: new Date().toISOString().split('T')[0],
              notes: 'Extracted from chief complaint'
            }

            toothDiagnosesData.push(toothDiagnosisData)
            console.log(`✅ [TOOTH EXTRACTION] Added tooth ${toothNum} from chief complaint to temporary list`)
          }
        }
      }
    }

    console.log(`🦷 [TOOTH EXTRACTION] Completed extraction. Found ${toothDiagnosesData.length} tooth diagnoses (temporary)`)
    return toothDiagnosesData

  } catch (error) {
    console.error('❌ [TOOTH EXTRACTION] Error extracting tooth diagnoses:', error)
    return []
  }
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
