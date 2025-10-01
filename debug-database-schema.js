const { createClient } = require('@supabase/supabase-js')

// Database schema audit script
async function auditDatabaseSchema() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log('🔍 ENDOFLOW DATABASE SCHEMA AUDIT')
  console.log('=' .repeat(50))

  try {
    // Check if api schema exists
    console.log('\n📋 1. CHECKING API SCHEMA')
    const { data: schemas, error: schemaError } = await supabase
      .rpc('exec_sql', {
        sql: "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'api'"
      })

    if (schemaError) {
      console.log('⚠️  Cannot check schemas (using alternative method)')
    } else {
      console.log('✅ API schema exists:', schemas?.length > 0)
    }

    // Check existing tables in api schema
    console.log('\n📋 2. CHECKING EXISTING TABLES')
    const tablesToCheck = ['consultations', 'tooth_diagnoses', 'voice_sessions']

    for (const tableName of tablesToCheck) {
      try {
        const { data, error } = await supabase
          .schema('api')
          .from(tableName)
          .select('*')
          .limit(1)

        if (error) {
          console.log(`❌ Table '${tableName}' - Error: ${error.message}`)
        } else {
          console.log(`✅ Table '${tableName}' - Exists and accessible`)
        }
      } catch (err) {
        console.log(`❌ Table '${tableName}' - Exception: ${err.message}`)
      }
    }

    // Check consultations table structure
    console.log('\n📋 3. CHECKING CONSULTATIONS TABLE STRUCTURE')
    try {
      const { data, error } = await supabase
        .schema('api')
        .from('consultations')
        .select('*')
        .limit(0)

      if (error) {
        console.log('❌ Cannot access consultations table:', error.message)
      } else {
        console.log('✅ Consultations table accessible')

        // Try to get column information
        const { data: sampleData, error: sampleError } = await supabase
          .schema('api')
          .from('consultations')
          .select('*')
          .limit(1)

        if (!sampleError && sampleData) {
          console.log('📝 Available columns in consultations:', Object.keys(sampleData[0] || {}))
        }
      }
    } catch (err) {
      console.log('❌ Consultations table error:', err.message)
    }

    // Check tooth_diagnoses table structure
    console.log('\n📋 4. CHECKING TOOTH_DIAGNOSES TABLE STRUCTURE')
    try {
      const { data, error } = await supabase
        .schema('api')
        .from('tooth_diagnoses')
        .select('*')
        .limit(0)

      if (error) {
        console.log('❌ Cannot access tooth_diagnoses table:', error.message)
      } else {
        console.log('✅ Tooth_diagnoses table accessible')

        // Try to get column information
        const { data: sampleData, error: sampleError } = await supabase
          .schema('api')
          .from('tooth_diagnoses')
          .select('*')
          .limit(1)

        if (!sampleError && sampleData) {
          console.log('📝 Available columns in tooth_diagnoses:', Object.keys(sampleData[0] || {}))
        }
      }
    } catch (err) {
      console.log('❌ Tooth_diagnoses table error:', err.message)
    }

    // Test the existing save action structure
    console.log('\n📋 5. TESTING SAVE ACTION COMPATIBILITY')
    try {
      // Test if we can insert a minimal consultation record
      const testConsultation = {
        patient_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
        dentist_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
        status: 'draft',
        chief_complaint: 'Database audit test'
      }

      const { data, error } = await supabase
        .schema('api')
        .from('consultations')
        .insert(testConsultation)
        .select()

      if (error) {
        console.log('❌ Test insert failed:', error.message)
        console.log('📝 Error details:', error)
      } else {
        console.log('✅ Test insert successful - deleting test record')
        // Clean up test record
        await supabase
          .schema('api')
          .from('consultations')
          .delete()
          .eq('id', data[0].id)
      }
    } catch (err) {
      console.log('❌ Test insert exception:', err.message)
    }

    console.log('\n🎯 AUDIT COMPLETE')
    console.log('=' .repeat(50))

  } catch (error) {
    console.error('❌ Database audit failed:', error.message)
  }
}

auditDatabaseSchema().catch(console.error)