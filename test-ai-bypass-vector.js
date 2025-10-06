/**
 * Test AI Flow with Vector Search Bypass
 * This tests if the AI generates responses when we bypass the problematic vector search
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY

console.log('🧪 Testing AI Flow with Vector Search Bypass\n')

async function testAIWithoutVectorSearch() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  console.log('🔧 Step 1: Get medical knowledge directly...')
  
  // Get medical knowledge without vector search
  const { data: knowledge, error } = await supabase
    .schema('api')
    .from('medical_knowledge')
    .select('*')
    .not('embedding', 'is', null)
    .limit(3)

  if (error) {
    console.log('❌ Failed to get medical knowledge:', error.message)
    return
  }

  console.log(`✅ Retrieved ${knowledge.length} medical knowledge entries`)
  
  console.log('\n🤖 Step 2: Test Gemini treatment suggestion...')
  
  try {
    // Test the Gemini API directly with the retrieved knowledge
    const medicalContext = knowledge.map(doc => ({
      title: doc.title,
      content: doc.content,
      journal: doc.journal,
      year: doc.publication_year,
      doi: doc.doi
    }))

    // Generate treatment suggestion using Gemini
    const suggestion = await generateTreatmentSuggestionDirect({
      diagnosis: 'Irreversible pulpitis',
      toothNumber: '24',
      medicalContext,
      patientContext: { age: 35 }
    })

    console.log('✅ Gemini treatment suggestion generated!')
    console.log('   Treatment:', suggestion.treatment)
    console.log('   Confidence:', suggestion.confidence + '%')
    console.log('   Reasoning:', suggestion.reasoning.substring(0, 100) + '...')
    
    console.log('\n💾 Step 3: Test saving to cache...')
    
    // Test saving to AI cache
    const { error: cacheError } = await supabase
      .schema('api')
      .from('ai_suggestion_cache')
      .insert({
        diagnosis: 'Irreversible pulpitis',
        tooth_number: '24',
        suggested_treatment: suggestion.treatment,
        confidence_score: suggestion.confidence,
        reasoning: suggestion.reasoning,
        evidence_sources: suggestion.sources,
        alternative_treatments: suggestion.alternativeTreatments || [],
        contraindications: suggestion.contraindications || [],
        ai_model: 'gemini-2.0-flash',
        processing_time: 1500
      })

    if (cacheError) {
      console.log('❌ Cache save failed:', cacheError.message)
    } else {
      console.log('✅ AI suggestion cached successfully!')
    }

    console.log('\n🎉 SUCCESS: AI integration works when vector search is bypassed!')
    console.log('📋 The issue is specifically with the vector search function.')

  } catch (err) {
    console.log('❌ Gemini test failed:', err.message)
  }
}

// Direct implementation of Gemini treatment suggestion
async function generateTreatmentSuggestionDirect(params) {
  const { diagnosis, toothNumber, medicalContext, patientContext } = params

  // Build context from medical knowledge
  const context = medicalContext
    .map((doc, idx) =>
      `[Source ${idx + 1}]\n` +
      `Title: ${doc.title}\n` +
      `Journal: ${doc.journal || 'N/A'} (${doc.year || 'N/A'})\n` +
      `Content: ${doc.content.substring(0, 1500)}...\n`
    )
    .join('\n---\n\n')

  const systemInstruction = `You are an expert endodontist AI assistant. Based on evidence from research papers and textbooks, provide treatment recommendations.

IMPORTANT: Respond ONLY with valid JSON in this exact format:
{
  "treatment": "Primary treatment name",
  "confidence": 85,
  "reasoning": "Evidence-based explanation citing the research",
  "sources": [
    {"title": "Paper title", "journal": "Journal name", "year": 2023, "doi": "optional"}
  ],
  "alternativeTreatments": ["Alternative 1", "Alternative 2"],
  "contraindications": ["Contraindication 1", "Contraindication 2"]
}

Confidence score should be 0-100 based on evidence strength.`

  const userPrompt = `Based on this medical evidence:\n\n${context}\n\nProvide treatment recommendation for:\nDiagnosis: ${diagnosis}\nTooth Number: ${toothNumber}\n${
    patientContext
      ? `Patient Age: ${patientContext.age}\nMedical History: ${patientContext.medicalHistory || 'None reported'}`
      : ''
  }`

  // Call Gemini directly
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: userPrompt }]
        }],
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json'
        }
      })
    }
  )

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`)
  }

  const data = await response.json()
  const responseText = data.candidates[0].content.parts[0].text

  // Parse JSON response
  try {
    return JSON.parse(responseText)
  } catch (parseError) {
    console.error('❌ Failed to parse JSON response:', responseText)
    throw new Error('AI returned invalid JSON format')
  }
}

testAIWithoutVectorSearch().catch(error => {
  console.error('💥 Test failed:', error)
  process.exit(1)
})