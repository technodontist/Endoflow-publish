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
  }
});

async function createTable() {
  console.log('🚀 Creating endoflow_conversations table...\n');

  const createTableSQL = `
    -- Create the conversations table
    CREATE TABLE IF NOT EXISTS api.endoflow_conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      dentist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      messages JSONB NOT NULL DEFAULT '[]'::jsonb,
      intent_type TEXT,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      last_message_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    -- Create indexes for better query performance
    CREATE INDEX IF NOT EXISTS idx_endoflow_conversations_dentist_id
      ON api.endoflow_conversations(dentist_id);

    CREATE INDEX IF NOT EXISTS idx_endoflow_conversations_last_message_at
      ON api.endoflow_conversations(last_message_at DESC);

    CREATE INDEX IF NOT EXISTS idx_endoflow_conversations_intent_type
      ON api.endoflow_conversations(intent_type);

    -- Enable Row Level Security
    ALTER TABLE api.endoflow_conversations ENABLE ROW LEVEL SECURITY;

    -- Create RLS policies for dentists
    DO $$ 
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'api' 
        AND tablename = 'endoflow_conversations' 
        AND policyname = 'Dentists can view their own conversations'
      ) THEN
        CREATE POLICY "Dentists can view their own conversations"
          ON api.endoflow_conversations
          FOR SELECT
          TO authenticated
          USING (
            EXISTS (
              SELECT 1 FROM public.profiles
              WHERE id = auth.uid()
              AND role = 'dentist'
              AND status = 'active'
            )
            AND dentist_id = auth.uid()
          );
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'api' 
        AND tablename = 'endoflow_conversations' 
        AND policyname = 'Dentists can create their own conversations'
      ) THEN
        CREATE POLICY "Dentists can create their own conversations"
          ON api.endoflow_conversations
          FOR INSERT
          TO authenticated
          WITH CHECK (
            EXISTS (
              SELECT 1 FROM public.profiles
              WHERE id = auth.uid()
              AND role = 'dentist'
              AND status = 'active'
            )
            AND dentist_id = auth.uid()
          );
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'api' 
        AND tablename = 'endoflow_conversations' 
        AND policyname = 'Dentists can update their own conversations'
      ) THEN
        CREATE POLICY "Dentists can update their own conversations"
          ON api.endoflow_conversations
          FOR UPDATE
          TO authenticated
          USING (
            EXISTS (
              SELECT 1 FROM public.profiles
              WHERE id = auth.uid()
              AND role = 'dentist'
              AND status = 'active'
            )
            AND dentist_id = auth.uid()
          );
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'api' 
        AND tablename = 'endoflow_conversations' 
        AND policyname = 'Dentists can delete their own conversations'
      ) THEN
        CREATE POLICY "Dentists can delete their own conversations"
          ON api.endoflow_conversations
          FOR DELETE
          TO authenticated
          USING (
            EXISTS (
              SELECT 1 FROM public.profiles
              WHERE id = auth.uid()
              AND role = 'dentist'
              AND status = 'active'
            )
            AND dentist_id = auth.uid()
          );
      END IF;
    END $$;

    -- Grant necessary permissions
    GRANT SELECT, INSERT, UPDATE, DELETE ON api.endoflow_conversations TO authenticated;
    GRANT USAGE ON SCHEMA api TO authenticated;

    -- Add comments for documentation
    COMMENT ON TABLE api.endoflow_conversations IS 'Stores conversation history for EndoFlow Master AI orchestrator';
    COMMENT ON COLUMN api.endoflow_conversations.messages IS 'JSONB array of {role, content, timestamp, agentName} conversation messages';
    COMMENT ON COLUMN api.endoflow_conversations.intent_type IS 'Last detected intent type (clinical_research, appointment_scheduling, etc.)';
  `;

  try {
    console.log('📝 Executing SQL to create table and policies...');
    
    const { data, error } = await supabase.rpc('exec_sql', { sql: createTableSQL });

    if (error) {
      // The exec_sql RPC function might not exist, so let's try a different approach
      console.log('⚠️  RPC approach failed. Trying alternative method...\n');
      
      // Use raw SQL execution via Supabase REST API
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({ sql: createTableSQL })
      });

      if (!response.ok) {
        console.error('❌ Failed to create table via REST API');
        console.error('Status:', response.status);
        console.error('Details:', await response.text());
        console.log('\n📋 MANUAL STEPS REQUIRED:');
        console.log('1. Go to your Supabase dashboard');
        console.log('2. Navigate to SQL Editor');
        console.log('3. Copy and run: CREATE_ENDOFLOW_CONVERSATIONS_TABLE.sql');
        process.exit(1);
      }

      console.log('✅ Table creation request sent successfully!');
    } else {
      console.log('✅ Table created successfully!');
    }

    // Verify the table was created
    console.log('\n🔍 Verifying table creation...');
    const { data: testData, error: testError } = await supabase
      .from('endoflow_conversations')
      .select('id')
      .limit(1);

    if (testError) {
      console.error('❌ Table verification failed:', testError.message);
      console.log('\n📋 Please manually run CREATE_ENDOFLOW_CONVERSATIONS_TABLE.sql in Supabase SQL Editor');
      process.exit(1);
    }

    console.log('✅ Table verified successfully!\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ ENDOFLOW CONVERSATIONS TABLE IS READY!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📋 Table: api.endoflow_conversations');
    console.log('🔒 RLS enabled with dentist-only access policies');
    console.log('📊 Indexes created for optimal query performance');
    console.log('\n🎉 You can now test the voice conversation feature!');
    console.log('   The AI will now remember context from previous messages.\n');

  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
    console.log('\n📋 FALLBACK: Please manually create the table:');
    console.log('1. Open Supabase dashboard → SQL Editor');
    console.log('2. Run: CREATE_ENDOFLOW_CONVERSATIONS_TABLE.sql');
    process.exit(1);
  }
}

createTable()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
