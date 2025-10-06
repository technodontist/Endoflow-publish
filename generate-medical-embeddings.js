/**
 * Generate Embeddings for Medical Knowledge
 * This script generates Gemini embeddings for existing medical knowledge entries
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY

console.log('🔮 Starting Medical Knowledge Embedding Generation...\n')

async function generateEmbedding(text) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { parts: [{ text }] },
        taskType: 'RETRIEVAL_DOCUMENT',
        outputDimensionality: 768
      })
    }
  )

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`)
  }

  const data = await response.json()
  const embedding = data.embedding.values

  // Normalize embedding
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
  return embedding.map(val => val / norm)
}

async function generateEmbeddings() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !GEMINI_API_KEY) {
    console.error('❌ Missing environment variables:')
    console.log('   NEXT_PUBLIC_SUPABASE_URL:', !!SUPABASE_URL)
    console.log('   SUPABASE_SERVICE_ROLE_KEY:', !!SUPABASE_SERVICE_KEY)
    console.log('   GEMINI_API_KEY:', !!GEMINI_API_KEY)
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Get medical knowledge entries without embeddings
  console.log('📚 Fetching medical knowledge entries...')
  const { data: entries, error } = await supabase
    .schema('api')
    .from('medical_knowledge')
    .select('*')
    .is('embedding', null)

  if (error) {
    console.error('❌ Error fetching medical knowledge:', error.message)
    process.exit(1)
  }

  console.log(`📖 Found ${entries.length} entries without embeddings\n`)

  for (const entry of entries) {
    console.log(`🔮 Generating embedding for: "${entry.title}"`)
    
    try {
      // Combine title and content for embedding
      const textToEmbed = `${entry.title}\n\n${entry.content}`
      
      const embedding = await generateEmbedding(textToEmbed)
      
      // Update the entry with the embedding
      const { error: updateError } = await supabase
        .schema('api')
        .from('medical_knowledge')
        .update({ embedding })
        .eq('id', entry.id)

      if (updateError) {
        console.error(`❌ Error updating embedding for "${entry.title}":`, updateError.message)
      } else {
        console.log(`✅ Embedding generated and saved (${embedding.length} dimensions)`)
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))

    } catch (error) {
      console.error(`❌ Error processing "${entry.title}":`, error.message)
    }

    console.log('')
  }

  // Verify embeddings were generated
  const { data: updatedEntries } = await supabase
    .schema('api')
    .from('medical_knowledge')
    .select('id, title, embedding')

  const withEmbeddings = updatedEntries.filter(e => e.embedding !== null).length
  const total = updatedEntries.length

  console.log('═══════════════════════════════════════════════════════')
  console.log('🎉 Embedding Generation Complete!')
  console.log('═══════════════════════════════════════════════════════')
  console.log(`📊 Status: ${withEmbeddings}/${total} entries have embeddings`)
  console.log('✅ Your AI treatment suggestions should now work!')
  console.log('🚀 Next: Test the integration in your app')
  console.log('═══════════════════════════════════════════════════════')
}

generateEmbeddings().catch(error => {
  console.error('💥 Fatal error:', error)
  process.exit(1)
})