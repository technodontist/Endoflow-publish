/**
 * Temporary AI Integration Fix
 * This patches the AI treatment suggestions to work without vector search
 * Use this until the vector function schema issue is resolved
 */

console.log('🔧 Temporary AI Integration Fix\n')

const fs = require('fs')
const path = require('path')

const aiActionPath = path.join(__dirname, 'lib', 'actions', 'ai-treatment-suggestions.ts')

console.log('📄 Reading current AI action file...')

if (!fs.existsSync(aiActionPath)) {
  console.log('❌ AI action file not found at:', aiActionPath)
  process.exit(1)
}

const originalContent = fs.readFileSync(aiActionPath, 'utf8')

// Create backup
const backupPath = aiActionPath + '.backup'
fs.writeFileSync(backupPath, originalContent)
console.log('✅ Backup created:', backupPath)

// Create the patched version that bypasses vector search
const patchedContent = `'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface AISuggestion {
  treatment: string
  confidence: number
  reasoning: string
  sources: Array<{
    title: string
    journal: string
    year: number
    doi?: string
  }>
  alternativeTreatments?: string[]
  contraindications?: string[]
}

/**
 * Get AI treatment suggestion based on diagnosis
 * TEMPORARY VERSION: Bypasses vector search until schema issue is resolved
 */
export async function getAITreatmentSuggestionAction(params: {
  diagnosis: string
  toothNumber: string
  patientContext?: {
    age?: number
    medicalHistory?: string
    previousTreatments?: string
  }
}) {
  try {
    const supabase = await createServiceClient()

    // Verify user is authenticated dentist
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'dentist' || profile.status !== 'active') {
      return { success: false, error: 'Access denied' }
    }

    console.log('🤖 [AI TREATMENT] Generating suggestion for:', {
      diagnosis: params.diagnosis,
      toothNumber: params.toothNumber
    })

    // Check cache first
    const { data: cachedSuggestion } = await supabase
      .from('ai_suggestion_cache')
      .select('*')
      .eq('diagnosis', params.diagnosis)
      .eq('tooth_number', params.toothNumber)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (cachedSuggestion) {
      console.log('✅ [AI TREATMENT] Cache hit, returning cached suggestion')

      // Increment hit count
      await supabase
        .from('ai_suggestion_cache')
        .update({ hit_count: (cachedSuggestion.hit_count || 0) + 1 })
        .eq('id', cachedSuggestion.id)

      return {
        success: true,
        data: {
          treatment: cachedSuggestion.suggested_treatment,
          confidence: cachedSuggestion.confidence_score,
          reasoning: cachedSuggestion.reasoning,
          sources: cachedSuggestion.evidence_sources,
          alternativeTreatments: cachedSuggestion.alternative_treatments,
          contraindications: cachedSuggestion.contraindications
        } as AISuggestion,
        cached: true
      }
    }

    // Generate new suggestion using Google Gemini
    const startTime = Date.now()

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY
    if (!GEMINI_API_KEY) {
      return { success: false, error: 'GEMINI_API_KEY not configured. Please add it to .env.local' }
    }

    // TEMPORARY BYPASS: Get medical knowledge directly without vector search
    console.log('🔧 [AI TREATMENT] Using direct medical knowledge query (bypass vector search)...')
    
    const { data: relevantKnowledge, error: searchError } = await supabase
      .schema('api')
      .from('medical_knowledge')
      .select('*')
      .not('embedding', 'is', null)
      .limit(5) // Get all available knowledge for now

    if (searchError) {
      console.error('❌ [AI TREATMENT] Direct knowledge query failed:', searchError)
      return { success: false, error: 'Failed to retrieve medical knowledge base' }
    }

    if (!relevantKnowledge || relevantKnowledge.length === 0) {
      console.warn('⚠️ [AI TREATMENT] No medical knowledge found')
      return {
        success: false,
        error: 'No medical knowledge found. Please upload textbooks/research papers to the knowledge base first.'
      }
    }

    console.log(\`📚 [AI TREATMENT] Found \${relevantKnowledge.length} medical knowledge entries\`)

    // Call Gemini for treatment recommendation
    console.log('🧠 [AI TREATMENT] Calling Gemini 2.0 Flash for recommendation...')

    const { generateTreatmentSuggestion } = await import('@/lib/services/gemini-ai')

    let suggestion: AISuggestion
    try {
      // Prepare medical context from direct query results
      const medicalContext = relevantKnowledge.map((doc: any) => ({
        title: doc.title,
        content: doc.content,
        journal: doc.journal,
        year: doc.publication_year,
        doi: doc.doi
      }))

      suggestion = await generateTreatmentSuggestion({
        diagnosis: params.diagnosis,
        toothNumber: params.toothNumber,
        medicalContext,
        patientContext: params.patientContext
      })
    } catch (error) {
      console.error('❌ [AI TREATMENT] Gemini call failed:', error)
      return { success: false, error: 'Failed to generate AI recommendation with Gemini' }
    }

    const processingTime = Date.now() - startTime

    console.log('✅ [AI TREATMENT] Suggestion generated:', {
      treatment: suggestion.treatment,
      confidence: suggestion.confidence,
      processingTime: \`\${processingTime}ms\`
    })

    // Cache the suggestion
    await supabase
      .from('ai_suggestion_cache')
      .insert({
        diagnosis: params.diagnosis,
        tooth_number: params.toothNumber,
        patient_context: params.patientContext || {},
        suggested_treatment: suggestion.treatment,
        confidence_score: suggestion.confidence,
        reasoning: suggestion.reasoning,
        evidence_sources: suggestion.sources,
        alternative_treatments: suggestion.alternativeTreatments || [],
        contraindications: suggestion.contraindications || [],
        ai_model: 'gemini-2.0-flash',
        processing_time: processingTime
      })

    return {
      success: true,
      data: suggestion,
      cached: false,
      processingTime
    }

  } catch (error) {
    console.error('❌ [AI TREATMENT] Error:', error)
    return { success: false, error: 'Failed to generate treatment suggestion' }
  }
}

/**
 * Clear AI suggestion cache for specific diagnosis
 */
export async function clearAISuggestionCacheAction(diagnosis?: string) {
  try {
    const supabase = await createServiceClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    let query = supabase.from('ai_suggestion_cache').delete()

    if (diagnosis) {
      query = query.eq('diagnosis', diagnosis)
    } else {
      // Clear expired cache entries
      query = query.lt('expires_at', new Date().toISOString())
    }

    const { error } = await query

    if (error) {
      return { success: false, error: error.message }
    }

    console.log('✅ [AI TREATMENT] Cache cleared')

    revalidatePath('/dentist')

    return { success: true }

  } catch (error) {
    console.error('❌ [AI TREATMENT] Cache clear error:', error)
    return { success: false, error: 'Failed to clear cache' }
  }
}

/**
 * Get AI suggestion cache statistics
 */
export async function getAICacheStatsAction() {
  try {
    const supabase = await createServiceClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    const { data: cacheEntries } = await supabase
      .from('ai_suggestion_cache')
      .select('*')

    if (!cacheEntries) {
      return { success: true, data: { total: 0, active: 0, expired: 0, totalHits: 0 } }
    }

    const now = new Date()
    const stats = {
      total: cacheEntries.length,
      active: cacheEntries.filter(e => new Date(e.expires_at) > now).length,
      expired: cacheEntries.filter(e => new Date(e.expires_at) <= now).length,
      totalHits: cacheEntries.reduce((sum, e) => sum + (e.hit_count || 0), 0)
    }

    return { success: true, data: stats }

  } catch (error) {
    console.error('❌ [AI TREATMENT] Cache stats error:', error)
    return { success: false, error: 'Failed to fetch cache statistics' }
  }
}
`

// Write the patched version
fs.writeFileSync(aiActionPath, patchedContent)

console.log('✅ AI action file patched successfully!')
console.log('🎉 Your AI integration should now work!')
console.log('\n📋 What was changed:')
console.log('   ✅ Bypassed vector search function')
console.log('   ✅ Uses direct medical knowledge query')
console.log('   ✅ Maintains all other AI functionality')
console.log('\n🔄 To restore original:')
console.log(`   Copy ${backupPath} back to ${aiActionPath}`)
console.log('\n🚀 Next steps:')
console.log('   1. Start your dev server: npm run dev')
console.log('   2. Test AI treatment suggestions in your app')
console.log('   3. Run fix_vector_function_public_schema.sql in Supabase to fix permanently')
`

console.log('🔧 Creating temporary AI integration fix...')
eval(fs.readFileSync(__filename, 'utf8').split('`')[1])