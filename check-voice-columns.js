// Quick script to check if voice columns exist in consultations table
// Run: node check-voice-columns.js

const { createClient } = require('@supabase/supabase-js')

async function checkVoiceColumns() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in environment variables')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  })

  console.log('🔍 Checking consultations table columns...\n')

  // Try to query with voice columns
  const { data, error } = await supabase
    .from('consultations')
    .select('id, global_voice_transcript, global_voice_processed_data, voice_recording_duration')
    .limit(1)

  if (error) {
    if (error.message.includes('global_voice_transcript') || error.message.includes('global_voice_processed_data')) {
      console.log('❌ VOICE COLUMNS MISSING!')
      console.log('\n📝 You need to run the SQL migration:')
      console.log('   1. Open Supabase Dashboard → SQL Editor')
      console.log('   2. Copy contents of: ADD_VOICE_COLUMNS_TO_CONSULTATIONS.sql')
      console.log('   3. Run the script')
      console.log('   4. Try voice recording again\n')
      return false
    }
    console.error('❌ Error:', error.message)
    return false
  }

  console.log('✅ VOICE COLUMNS EXIST!')
  console.log('\n📊 Column status:')
  console.log('   ✅ global_voice_transcript')
  console.log('   ✅ global_voice_processed_data')
  console.log('   ✅ voice_recording_duration')
  console.log('\n🎉 Database is ready for voice AI feature!\n')
  return true
}

checkVoiceColumns()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('❌ Unexpected error:', error)
    process.exit(1)
  })
