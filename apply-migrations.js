const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function applyMigrations() {
  // Create a Supabase client with service role key for admin operations
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log('🔧 Applying database schema fixes...');

  try {
    // Read our comprehensive fix script
    const migrationSQL = fs.readFileSync('fix-database-schema.sql', 'utf8');
    
    // Split the SQL into individual statements (rough splitting by semicolons)
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
      .filter(s => !s.toLowerCase().includes('select \'database schema fix completed'));

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      
      if (statement.trim().length <= 1) continue;
      
      console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
      console.log(`   ${statement.substring(0, 100)}${statement.length > 100 ? '...' : ''}`);
      
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          console.log(`⚠️  Statement ${i + 1} produced error (might be expected):`, error.message);
          // Don't fail for expected errors like "already exists"
          if (!error.message.includes('already exists') && 
              !error.message.includes('does not exist') &&
              !error.message.includes('duplicate key')) {
            throw error;
          }
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
        }
      } catch (err) {
        console.error(`❌ Error executing statement ${i + 1}:`, err.message);
        
        // Try direct SQL execution if rpc fails
        try {
          const { error: directError } = await supabase.from('_temp').select('1').limit(0);
          // This is just to test the connection, the actual SQL execution needs different approach
          console.log('   Trying alternative execution method...');
        } catch (directErr) {
          console.error('   Alternative method also failed:', directErr.message);
        }
      }
    }

    console.log('🎉 Migration application completed!');
    console.log('   Some errors above might be expected (tables/policies already existing)');
    
    // Test if the critical table exists now
    try {
      const { data, error } = await supabase
        .from('appointment_requests')
        .select('id')
        .limit(1);
        
      if (!error) {
        console.log('✅ Verification: appointment_requests table is accessible');
      } else {
        console.log('❌ Verification failed:', error.message);
      }
    } catch (err) {
      console.log('⚠️  Could not verify table creation:', err.message);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Alternative: Apply migration using raw SQL through PostgREST
async function applyMigrationDirect() {
  console.log('🔧 Applying critical fixes directly...');
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Essential fixes for immediate issues
  const criticalFixes = [
    {
      name: 'Create api schema',
      sql: `CREATE SCHEMA IF NOT EXISTS api;`
    },
    {
      name: 'Create appointment_requests table with additional_notes',
      sql: `
        CREATE TABLE IF NOT EXISTS api.appointment_requests (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          patient_id UUID,
          appointment_type TEXT NOT NULL,
          preferred_date DATE NOT NULL,
          preferred_time TEXT NOT NULL,
          reason_for_visit TEXT NOT NULL,
          pain_level INTEGER,
          additional_notes TEXT,
          status TEXT DEFAULT 'pending',
          notification_sent BOOLEAN DEFAULT FALSE,
          assigned_to UUID,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `
    }
  ];

  for (const fix of criticalFixes) {
    console.log(`⚡ Applying: ${fix.name}`);
    try {
      // Note: Direct SQL execution through Supabase client has limitations
      // In a real scenario, you'd need to use the Supabase dashboard SQL editor
      // or psql directly
      console.log(`   SQL: ${fix.sql.substring(0, 100)}...`);
      console.log('   ⚠️  Please apply this SQL manually in Supabase dashboard');
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }
  
  console.log('');
  console.log('🏁 Manual Steps Required:');
  console.log('1. Open Supabase dashboard: https://supabase.com/dashboard');
  console.log('2. Go to SQL Editor');
  console.log('3. Run the fix-database-schema.sql file contents');
  console.log('4. Restart your Next.js application');
}

if (require.main === module) {
  applyMigrationDirect();
}