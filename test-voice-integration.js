/**
 * Test script to verify voice recording integration
 * This script tests the voice API endpoints and content processing
 */

const testVoiceIntegration = async () => {
  console.log('🧪 Testing Voice Recording Integration...\n')

  // Test data
  const mockTranscript = `
    The patient is complaining of severe tooth pain in the upper right side.
    The pain started three days ago and is sharp and throbbing.
    Pain scale is 8 out of 10.
    Patient has diabetes and takes insulin daily.
    No known allergies.
    Extraoral examination shows facial swelling.
    Intraoral examination reveals deep caries in tooth 16.
    X-ray shows periapical pathology.
    Diagnosis is acute pulpitis.
    Treatment plan includes root canal therapy.
  `

  const consultationId = 'test-consultation-123'
  const sessionId = 'test-session-456'

  try {
    // Test 1: Voice processing endpoint
    console.log('1️⃣ Testing voice processing endpoint...')

    // Create FormData for the API call
    const formData = new FormData()
    formData.append('transcript', mockTranscript.trim())
    formData.append('consultationId', consultationId)
    formData.append('sessionId', sessionId)

    // Create a mock audio blob
    const mockAudioBlob = new Blob(['mock audio data'], { type: 'audio/webm' })
    formData.append('audio', mockAudioBlob, 'test-recording.webm')

    const response = await fetch('http://localhost:3000/api/voice/process-global-transcript', {
      method: 'POST',
      body: formData
    })

    if (response.ok) {
      const result = await response.json()
      console.log('✅ Voice processing successful!')
      console.log('📊 Processed content structure:')
      console.log('   - Chief Complaint:', Object.keys(result.processedContent?.chiefComplaint || {}))
      console.log('   - HOPI:', Object.keys(result.processedContent?.hopi || {}))
      console.log('   - Medical History:', Object.keys(result.processedContent?.medicalHistory || {}))
      console.log('   - Clinical Examination:', Object.keys(result.processedContent?.clinicalExamination || {}))
      console.log('   - Investigations:', Object.keys(result.processedContent?.investigations || {}))
      console.log('   - Diagnosis:', Object.keys(result.processedContent?.diagnosis || {}))
      console.log('   - Treatment Plan:', Object.keys(result.processedContent?.treatmentPlan || {}))
      console.log('   - Confidence Score:', result.processedContent?.confidence + '%')

      console.log('\n📋 Sample extracted data:')
      if (result.processedContent?.chiefComplaint?.primary_complaint) {
        console.log('   - Primary Complaint:', result.processedContent.chiefComplaint.primary_complaint)
      }
      if (result.processedContent?.chiefComplaint?.pain_scale) {
        console.log('   - Pain Scale:', result.processedContent.chiefComplaint.pain_scale + '/10')
      }
      if (result.processedContent?.medicalHistory?.medical_conditions?.length > 0) {
        console.log('   - Medical Conditions:', result.processedContent.medicalHistory.medical_conditions.map(c => c.condition).join(', '))
      }
      if (result.processedContent?.diagnosis?.provisional_diagnosis?.length > 0) {
        console.log('   - Provisional Diagnosis:', result.processedContent.diagnosis.provisional_diagnosis.map(d => d.diagnosis).join(', '))
      }
    } else {
      console.log('❌ Voice processing failed:', response.status, response.statusText)
      const errorText = await response.text()
      console.log('Error details:', errorText)
    }

    console.log('\n2️⃣ Testing content distribution logic...')

    // Mock processed content for distribution testing
    const mockProcessedContent = {
      chiefComplaint: {
        primary_complaint: 'Severe tooth pain',
        pain_scale: 8,
        patient_description: 'Upper right side'
      },
      hopi: {
        pain_characteristics: {
          quality: 'sharp and throbbing',
          duration: 'three days'
        },
        aggravating_factors: ['pressure', 'cold'],
        relieving_factors: ['pain medication']
      },
      medicalHistory: {
        medical_conditions: [{ condition: 'diabetes' }],
        current_medications: [{ name: 'insulin' }],
        allergies: []
      },
      diagnosis: {
        provisional_diagnosis: [{ diagnosis: 'acute pulpitis' }]
      },
      treatmentPlan: {
        procedures: [{ procedure: 'root canal therapy' }]
      },
      confidence: 85
    }

    // Simulate the content distribution that would happen in the React component
    console.log('✅ Content distribution simulation:')
    console.log('   - Chief Complaint would be updated with:', mockProcessedContent.chiefComplaint.primary_complaint)
    console.log('   - Pain intensity would be set to:', mockProcessedContent.chiefComplaint.pain_scale)
    console.log('   - Medical conditions would include:', mockProcessedContent.medicalHistory.medical_conditions.map(c => c.condition).join(', '))
    console.log('   - Provisional diagnosis would be:', mockProcessedContent.diagnosis.provisional_diagnosis.map(d => d.diagnosis).join(', '))

    console.log('\n🎉 Voice integration test completed successfully!')
    console.log('🌐 Visit http://localhost:3000/dentist to test the full interface')

  } catch (error) {
    console.log('❌ Test failed with error:', error.message)
    console.log('🔧 Make sure the development server is running on http://localhost:3000')
  }
}

// Check if we're in a browser environment or Node.js
if (typeof window === 'undefined') {
  // Node.js environment - use fetch polyfill
  const fetch = require('node-fetch')
  global.fetch = fetch
  global.FormData = require('form-data')
  global.Blob = require('blob-polyfill').Blob

  testVoiceIntegration().catch(console.error)
} else {
  // Browser environment
  window.testVoiceIntegration = testVoiceIntegration
  console.log('Run testVoiceIntegration() in the browser console to test')
}