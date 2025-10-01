const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function createTables() {
  try {
    console.log('🚀 Creating prescription alarm tables directly...')

    // Create prescription_alarms table
    console.log('📋 Creating prescription_alarms table...')

    const createAlarmsTableSQL = `
CREATE TABLE IF NOT EXISTS api.prescription_alarms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL, -- References auth.users.id

    -- Medication details
    medication_name text NOT NULL,
    dosage text NOT NULL,
    form text, -- tablet, capsule, liquid, etc.

    -- Schedule configuration
    schedule_type text NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'monthly', 'custom')),
    frequency_per_day integer NOT NULL DEFAULT 1,
    specific_times text NOT NULL, -- JSON array of times ["09:00", "21:00"]

    -- Duration settings
    duration_type text NOT NULL CHECK (duration_type IN ('days', 'weeks', 'months', 'ongoing')),
    duration_value integer, -- Number of days/weeks/months
    start_date date NOT NULL DEFAULT CURRENT_DATE,
    end_date date, -- Calculated or manually set

    -- Alarm settings
    alarm_enabled boolean NOT NULL DEFAULT true,
    alarm_sound text NOT NULL DEFAULT 'default',
    snooze_enabled boolean NOT NULL DEFAULT true,
    snooze_duration_minutes integer NOT NULL DEFAULT 10,

    -- Instructions and notes
    instructions text,
    additional_notes text,

    -- Status tracking
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
    is_archived boolean NOT NULL DEFAULT false,

    -- Metadata
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);`

    // Execute table creation via RPC if available, otherwise skip with warning
    try {
      const { error: createError } = await supabase.rpc('exec_sql', { sql: createAlarmsTableSQL })
      if (createError) {
        console.log('⚠️  Could not execute via RPC, table may already exist')
      } else {
        console.log('✅ prescription_alarms table created')
      }
    } catch (rpcError) {
      console.log('⚠️  RPC not available, assuming table exists')
    }

    // Create alarm_instances table
    console.log('📋 Creating alarm_instances table...')

    const createInstancesTableSQL = `
CREATE TABLE IF NOT EXISTS api.alarm_instances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_alarm_id uuid NOT NULL, -- References api.prescription_alarms.id
    patient_id uuid NOT NULL, -- References auth.users.id

    -- Scheduled time details
    scheduled_date date NOT NULL,
    scheduled_time time NOT NULL,
    scheduled_datetime timestamp with time zone NOT NULL,

    -- Status tracking
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'taken', 'skipped', 'missed', 'snoozed')),
    taken_at timestamp with time zone,
    skipped_at timestamp with time zone,
    dismissed_at timestamp with time zone,

    -- Snooze tracking
    snooze_count integer NOT NULL DEFAULT 0,
    snooze_until timestamp with time zone,
    original_time timestamp with time zone,

    -- Patient feedback
    patient_notes text,
    side_effects_reported text,

    -- Notification tracking
    notification_sent boolean NOT NULL DEFAULT false,
    notification_sent_at timestamp with time zone,
    browser_notification_id text, -- For managing browser notifications

    -- Metadata
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);`

    try {
      const { error: createError2 } = await supabase.rpc('exec_sql', { sql: createInstancesTableSQL })
      if (createError2) {
        console.log('⚠️  Could not execute via RPC, table may already exist')
      } else {
        console.log('✅ alarm_instances table created')
      }
    } catch (rpcError) {
      console.log('⚠️  RPC not available, assuming table exists')
    }

    // Test table access
    console.log('\n🔍 Testing table access...')

    const { data: alarmsTest, error: alarmsError } = await supabase
      .schema('api')
      .from('prescription_alarms')
      .select('*')
      .limit(1)

    if (alarmsError) {
      console.log('❌ prescription_alarms access error:', alarmsError.message)
    } else {
      console.log('✅ prescription_alarms table accessible')
    }

    const { data: instancesTest, error: instancesError } = await supabase
      .schema('api')
      .from('alarm_instances')
      .select('*')
      .limit(1)

    if (instancesError) {
      console.log('❌ alarm_instances access error:', instancesError.message)
    } else {
      console.log('✅ alarm_instances table accessible')
    }

    console.log('\n🎉 Table creation process completed!')

  } catch (error) {
    console.error('❌ Table creation failed:', error.message)
  }
}

createTables()