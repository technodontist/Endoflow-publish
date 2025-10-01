const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const supabaseUrl = "https://pxpfbeqlqqrjpkiqlxmi.supabase.co"
const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4cGZiZXFscXFyanBraXFseG1pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzE3ODQyNywiZXhwIjoyMDcyNzU0NDI3fQ.8dOLsTfkiflfl8xprKTfTCxku0wvuvkpbDOIWc8oNkU"

const supabase = createClient(supabaseUrl, serviceKey)

async function createTables() {
  console.log('🚀 [SIMPLE DEPLOYMENT] Creating messaging tables...\n')

  // Create message_threads table
  console.log('📋 [TABLE 1] Creating api.message_threads...')
  const { data: table1, error: error1 } = await supabase.sql`
    CREATE TABLE IF NOT EXISTS "api"."message_threads" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "patient_id" uuid NOT NULL,
      "dentist_id" uuid NOT NULL,
      "subject" text NOT NULL,
      "last_message_at" timestamp DEFAULT now() NOT NULL,
      "last_message_preview" text,
      "status" text DEFAULT 'active' NOT NULL,
      "priority" text DEFAULT 'normal' NOT NULL,
      "is_urgent" boolean DEFAULT false NOT NULL,
      "patient_unread_count" integer DEFAULT 0 NOT NULL,
      "dentist_unread_count" integer DEFAULT 0 NOT NULL,
      "message_count" integer DEFAULT 0 NOT NULL,
      "tags" text,
      "related_appointment_id" uuid,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );
  `

  if (error1) {
    if (error1.message.includes('already exists')) {
      console.log('   ℹ️  Table already exists, continuing...')
    } else {
      console.error('   ❌ Error:', error1.message)
    }
  } else {
    console.log('   ✅ message_threads created successfully')
  }

  // Create thread_messages table
  console.log('\n📋 [TABLE 2] Creating api.thread_messages...')
  const { data: table2, error: error2 } = await supabase.sql`
    CREATE TABLE IF NOT EXISTS "api"."thread_messages" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "thread_id" uuid NOT NULL,
      "sender_id" uuid NOT NULL,
      "sender_type" text NOT NULL,
      "content" text NOT NULL,
      "message_type" text DEFAULT 'text' NOT NULL,
      "attachments" text,
      "is_read" boolean DEFAULT false NOT NULL,
      "read_at" timestamp,
      "reply_to_message_id" uuid,
      "system_message_type" text,
      "system_message_data" text,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );
  `

  if (error2) {
    if (error2.message.includes('already exists')) {
      console.log('   ℹ️  Table already exists, continuing...')
    } else {
      console.error('   ❌ Error:', error2.message)
    }
  } else {
    console.log('   ✅ thread_messages created successfully')
  }

  // Enable RLS
  console.log('\n🔒 [RLS] Enabling Row Level Security...')

  const { data: rls1, error: rlsError1 } = await supabase.sql`
    ALTER TABLE "api"."message_threads" ENABLE ROW LEVEL SECURITY;
  `

  const { data: rls2, error: rlsError2 } = await supabase.sql`
    ALTER TABLE "api"."thread_messages" ENABLE ROW LEVEL SECURITY;
  `

  if (rlsError1 || rlsError2) {
    console.log('   ⚠️  RLS might already be enabled')
  } else {
    console.log('   ✅ RLS enabled on both tables')
  }

  // Create basic policies
  console.log('\n🛡️  [POLICIES] Creating access policies...')

  // Policy for message_threads SELECT
  const { error: policy1 } = await supabase.sql`
    CREATE POLICY "message_threads_select" ON "api"."message_threads"
    FOR SELECT TO authenticated
    USING (patient_id = auth.uid() OR dentist_id = auth.uid());
  `

  // Policy for message_threads INSERT
  const { error: policy2 } = await supabase.sql`
    CREATE POLICY "message_threads_insert" ON "api"."message_threads"
    FOR INSERT TO authenticated
    WITH CHECK (patient_id = auth.uid() OR dentist_id = auth.uid());
  `

  // Policy for thread_messages SELECT
  const { error: policy3 } = await supabase.sql`
    CREATE POLICY "thread_messages_select" ON "api"."thread_messages"
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM "api"."message_threads"
        WHERE id = thread_id
        AND (patient_id = auth.uid() OR dentist_id = auth.uid())
      )
    );
  `

  // Policy for thread_messages INSERT
  const { error: policy4 } = await supabase.sql`
    CREATE POLICY "thread_messages_insert" ON "api"."thread_messages"
    FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM "api"."message_threads"
        WHERE id = thread_id
        AND (patient_id = auth.uid() OR dentist_id = auth.uid())
      )
      AND sender_id = auth.uid()
    );
  `

  // Check policies results
  if (policy1?.message?.includes('already exists') || !policy1) {
    console.log('   ✅ message_threads SELECT policy created/exists')
  } else {
    console.log('   ⚠️  message_threads SELECT policy issue:', policy1.message)
  }

  // Create indexes
  console.log('\n⚡ [INDEXES] Creating performance indexes...')

  const indexes = [
    'CREATE INDEX IF NOT EXISTS "idx_message_threads_patient" ON "api"."message_threads"("patient_id");',
    'CREATE INDEX IF NOT EXISTS "idx_message_threads_dentist" ON "api"."message_threads"("dentist_id");',
    'CREATE INDEX IF NOT EXISTS "idx_thread_messages_thread" ON "api"."thread_messages"("thread_id");'
  ]

  for (const indexSql of indexes) {
    const { error: indexError } = await supabase.sql([indexSql])
    if (!indexError) {
      console.log('   ✅ Index created')
    }
  }

  // Test access
  console.log('\n🔍 [TEST] Testing table access...')

  try {
    const { data: testThreads, error: testError1 } = await supabase
      .schema('api')
      .from('message_threads')
      .select('count')
      .limit(1)

    if (testError1) {
      console.log('   ❌ message_threads access error:', testError1.message)
    } else {
      console.log('   ✅ message_threads accessible')
    }
  } catch (e) {
    console.log('   ❌ message_threads exception:', e.message)
  }

  try {
    const { data: testMessages, error: testError2 } = await supabase
      .schema('api')
      .from('thread_messages')
      .select('count')
      .limit(1)

    if (testError2) {
      console.log('   ❌ thread_messages access error:', testError2.message)
    } else {
      console.log('   ✅ thread_messages accessible')
    }
  } catch (e) {
    console.log('   ❌ thread_messages exception:', e.message)
  }

  console.log('\n🎉 [COMPLETE] Messaging tables deployment finished!')
  console.log('   Ready to test messaging functionality in the app')
}

createTables().catch(console.error)