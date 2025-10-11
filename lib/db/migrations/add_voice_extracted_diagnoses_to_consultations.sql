-- Migration: Add voice extraction fields to consultations table
-- This allows storing voice-extracted tooth diagnoses for auto-populating diagnosis dialogs

-- Add new columns to consultations table
ALTER TABLE api.consultations
ADD COLUMN IF NOT EXISTS global_voice_transcript TEXT,
ADD COLUMN IF NOT EXISTS global_voice_processed_data TEXT,
ADD COLUMN IF NOT EXISTS voice_recording_duration INTEGER,
ADD COLUMN IF NOT EXISTS voice_extracted_tooth_diagnoses TEXT;

-- Add comments for documentation
COMMENT ON COLUMN api.consultations.global_voice_transcript IS 'Full consultation voice recording transcript';
COMMENT ON COLUMN api.consultations.global_voice_processed_data IS 'JSON string of AI-processed voice data (chief complaint, HOPI, etc.)';
COMMENT ON COLUMN api.consultations.voice_recording_duration IS 'Duration of voice recording in seconds';
COMMENT ON COLUMN api.consultations.voice_extracted_tooth_diagnoses IS 'JSON string of tooth diagnoses extracted from voice transcript';

-- Log migration
DO $$
BEGIN
    RAISE NOTICE 'Migration completed: Added voice extraction fields to consultations table';
END $$;
