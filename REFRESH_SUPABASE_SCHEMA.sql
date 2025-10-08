-- Force refresh Supabase schema cache
-- Run this in Supabase SQL Editor after adding columns

-- Notify PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- Verify the columns exist
SELECT
  table_schema,
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'api'
  AND table_name = 'consultations'
  AND column_name IN (
    'global_voice_transcript',
    'global_voice_processed_data',
    'voice_recording_duration'
  )
ORDER BY column_name;

-- If the above query returns 0 rows, the columns don't exist yet
-- Run ADD_VOICE_COLUMNS_TO_CONSULTATIONS.sql first
