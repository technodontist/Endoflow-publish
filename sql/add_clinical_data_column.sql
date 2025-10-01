-- Adds clinical_data JSONB column if it's missing
ALTER TABLE api.consultations ADD COLUMN IF NOT EXISTS clinical_data JSONB;

-- Optional: index for faster JSONB queries
CREATE INDEX IF NOT EXISTS idx_consultations_clinical_data ON api.consultations USING GIN (clinical_data);
