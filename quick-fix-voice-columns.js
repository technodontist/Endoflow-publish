/**
 * Quick Fix: Add Voice Extraction Columns
 *
 * This script directly adds the missing columns to fix the voice processing error.
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

async function addColumns() {
  console.log('🚀 Adding voice extraction columns to consultations table...\n')

  const columns = [
    {
      name: 'global_voice_transcript',
      type: 'TEXT',
      description: 'Full consultation voice recording transcript'
    },
    {
      name: 'global_voice_processed_data',
      type: 'TEXT',
      description: 'JSON string of AI-processed voice data'
    },
    {
      name: 'voice_recording_duration',
      type: 'INTEGER',
      description: 'Duration of voice recording in seconds'
    },
    {
      name: 'voice_extracted_tooth_diagnoses',
      type: 'TEXT',
      description: 'JSON string of tooth diagnoses extracted from voice'
    }
  ]

  for (const col of columns) {
    console.log(`\n📝 Adding column: ${col.name}`)
    console.log(`   Type: ${col.type}`)
    console.log(`   Description: ${col.description}`)

    const sql = `ALTER TABLE api.consultations ADD COLUMN IF NOT EXISTS ${col.name} ${col.type};`

    try {
      // Use raw SQL query
      const { data, error } = await supabase.rpc('exec_sql', {
        sql_query: sql
      })

      if (error) {
        // Try alternative method - direct from() with raw SQL
        console.log('   Trying alternative method...')

        // Use Postgres REST API directly
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({ sql_query: sql })
        })

        if (!response.ok) {
          console.log(`   ⚠️ Could not add via API (this is okay if column exists)`)
          console.log(`   Run this SQL manually in Supabase:`)
          console.log(`   ${sql}`)
        } else {
          console.log(`   ✅ Column added successfully`)
        }
      } else {
        console.log(`   ✅ Column added successfully`)
      }
    } catch (err) {
      console.log(`   ⚠️ ${err.message}`)
      console.log(`   If column doesn't exist, run this SQL in Supabase Dashboard:`)
      console.log(`   ${sql}`)
    }
  }

  console.log('\n\n📋 MANUAL STEPS (if automatic failed):')
  console.log('   1. Go to Supabase Dashboard → SQL Editor')
  console.log('   2. Paste and run this SQL:\n')
  console.log('   ALTER TABLE api.consultations')
  console.log('   ADD COLUMN IF NOT EXISTS global_voice_transcript TEXT,')
  console.log('   ADD COLUMN IF NOT EXISTS global_voice_processed_data TEXT,')
  console.log('   ADD COLUMN IF NOT EXISTS voice_recording_duration INTEGER,')
  console.log('   ADD COLUMN IF NOT EXISTS voice_extracted_tooth_diagnoses TEXT;')
  console.log('\n✅ Done! Restart your dev server and try voice recording again.')
}

addColumns()
