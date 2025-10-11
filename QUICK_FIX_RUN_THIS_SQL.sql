-- QUICK FIX: Run this SQL in Supabase Dashboard to fix voice processing error
-- This adds the missing columns needed for voice-to-diagnosis feature

-- Add voice extraction columns to consultations table
ALTER TABLE api.consultations
ADD COLUMN IF NOT EXISTS global_voice_transcript TEXT,
ADD COLUMN IF NOT EXISTS global_voice_processed_data TEXT,
ADD COLUMN IF NOT EXISTS voice_recording_duration INTEGER,
ADD COLUMN IF NOT EXISTS voice_extracted_tooth_diagnoses TEXT;

-- Verify columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'api'
  AND table_name = 'consultations'
  AND column_name IN (
    'global_voice_transcript',
    'global_voice_processed_data',
    'voice_recording_duration',
    'voice_extracted_tooth_diagnoses'
  );

-- You should see 4 rows returned if successful
