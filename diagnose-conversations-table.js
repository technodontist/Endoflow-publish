const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  }
});

async function diagnoseTable() {
  console.log('🔍 Diagnosing endoflow_conversations table location...\n');

  // Check public schema (default)
  console.log('1️⃣ Checking public.endoflow_conversations...');
  const { data: publicData, error: publicError } = await supabase
    .from('endoflow_conversations')
    .select('id, dentist_id, created_at, last_message_at')
    .limit(1);

  if (!publicError) {
    console.log('✅ Table EXISTS in PUBLIC schema');
    console.log(`   Found ${publicData?.length || 0} record(s)\n`);
  } else {
    console.log(`❌ Not in public schema: ${publicError.message}\n`);
  }

  // Try to create a Supabase client with api schema
  const supabaseApi = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: 'api'
    }
  });

  console.log('2️⃣ Checking api.endoflow_conversations...');
  const { data: apiData, error: apiError } = await supabaseApi
    .from('endoflow_conversations')
    .select('id, dentist_id, created_at, last_message_at')
    .limit(1);

  if (!apiError) {
    console.log('✅ Table EXISTS in API schema');
    console.log(`   Found ${apiData?.length || 0} record(s)\n`);
  } else {
    console.log(`❌ Not in api schema: ${apiError.message}\n`);
  }

  // Check the backend code to see which schema it's trying to use
  console.log('3️⃣ Checking what schema the backend expects...');
  const fs = require('fs');
  const backendPath = 'D:\\endoflow\\Endoflow-publish\\lib\\actions\\endoflow-master.ts';
  
  try {
    const backendCode = fs.readFileSync(backendPath, 'utf8');
    
    // Look for schema specification in the code
    if (backendCode.includes("schema: 'api'") || backendCode.includes('schema: "api"')) {
      console.log('   Backend expects: API schema\n');
    } else if (backendCode.includes("schema: 'public'") || backendCode.includes('schema: "public"')) {
      console.log('   Backend expects: PUBLIC schema\n');
    } else {
      console.log('   Backend expects: DEFAULT (public) schema\n');
    }

    // Check Supabase client configuration
    if (backendCode.includes('.from(\'endoflow_conversations\')')) {
      console.log('   ✅ Backend queries endoflow_conversations table\n');
    }
  } catch (err) {
    console.log('   ⚠️  Could not read backend file\n');
  }

  // Summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('📊 DIAGNOSIS SUMMARY');
  console.log('═══════════════════════════════════════════════════════');
  
  if (!publicError) {
    console.log('✅ Table exists in PUBLIC schema (default)');
    console.log('   This is likely correct if backend uses default schema');
  } else if (!apiError) {
    console.log('✅ Table exists in API schema');
    console.log('   Backend must explicitly use api schema');
  } else {
    console.log('❌ Table not found in either schema');
    console.log('   Something went wrong during creation');
  }

  console.log('\n💡 NEXT STEPS:');
  if (!publicError) {
    console.log('1. The table exists in public schema');
    console.log('2. Test the voice feature to see if it works now');
    console.log('3. If it still fails, check backend schema configuration\n');
  } else if (!apiError) {
    console.log('1. The table exists in api schema');
    console.log('2. Ensure backend Supabase client uses schema: "api"');
    console.log('3. Or move table to public schema\n');
  } else {
    console.log('1. Drop any partial tables that may exist');
    console.log('2. Re-run the CREATE table SQL');
    console.log('3. Make sure to use public schema (not api)\n');
  }
}

diagnoseTable()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
