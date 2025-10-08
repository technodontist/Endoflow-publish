-- Add voice recording columns to consultations table
-- Run this in Supabase SQL Editor

-- Add columns for voice recording data
ALTER TABLE api.consultations
ADD COLUMN IF NOT EXISTS global_voice_transcript TEXT,
ADD COLUMN IF NOT EXISTS global_voice_processed_data JSONB,
ADD COLUMN IF NOT EXISTS voice_recording_duration INTEGER;

-- Add comments for documentation
COMMENT ON COLUMN api.consultations.global_voice_transcript IS 'Raw transcript from voice recording (Web Speech API)';
COMMENT ON COLUMN api.consultations.global_voice_processed_data IS 'AI-processed structured data from Gemini (chiefComplaint, hopi, etc.)';
COMMENT ON COLUMN api.consultations.voice_recording_duration IS 'Recording duration in seconds';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_consultations_voice_transcript ON api.consultations USING gin(to_tsvector('english', global_voice_transcript));

-- Verify columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'api'
  AND table_name = 'consultations'
  AND column_name IN ('global_voice_transcript', 'global_voice_processed_data', 'voice_recording_duration');
