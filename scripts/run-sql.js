#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runSqlScript() {
  try {
    console.log('📝 Reading SQL script...');
    const sqlPath = path.join(__dirname, 'create-real-dentists.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    console.log('🚀 Executing SQL script...');

    // Split the SQL into individual statements (rough approach)
    // Note: This is a simplified approach. For complex SQL, consider using a proper parser
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt && !stmt.startsWith('--') && stmt !== 'COMMIT');

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement) {
        console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);

        const { data, error } = await supabase.rpc('exec_sql', {
          sql: statement
        });

        if (error) {
          console.error(`❌ Error in statement ${i + 1}:`, error);
          // Continue with other statements
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
          if (data) {
            console.log('   Result:', data);
          }
        }
      }
    }

    console.log('🎉 SQL script execution completed!');

  } catch (error) {
    console.error('❌ Error running SQL script:', error);
    process.exit(1);
  }
}

// Alternative approach: Use the raw SQL execution method
async function runSqlDirect() {
  try {
    console.log('📝 Reading SQL script...');
    const sqlPath = path.join(__dirname, 'create-real-dentists.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    console.log('🚀 Executing SQL script directly...');

    // Try to execute the entire script at once
    const { data, error } = await supabase
      .from('any_table') // This won't be used
      .select()
      .eq('id', 'fake'); // This query won't run due to the custom SQL

    // Since Supabase client doesn't directly support raw SQL execution,
    // let's use the REST API approach
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({
        sql: sqlContent
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ SQL executed successfully:', result);

  } catch (error) {
    console.error('❌ Error executing SQL:', error);

    // Fallback: Show manual instructions
    console.log('\n📋 MANUAL EXECUTION REQUIRED:');
    console.log('1. Go to your Supabase Dashboard: https://supabase.com/dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy the following SQL and execute it:\n');

    const sqlPath = path.join(__dirname, 'create-real-dentists.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    console.log('='.repeat(60));
    console.log(sqlContent);
    console.log('='.repeat(60));
  }
}

runSqlDirect();