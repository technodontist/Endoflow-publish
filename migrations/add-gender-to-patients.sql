-- Migration: Add gender column to patients table
-- Date: 2025-10-12
-- Description: Add gender field to api.patients table to support gender registration

-- Add gender column to patients table
ALTER TABLE api.patients 
ADD COLUMN gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say'));

-- Add comment to explain the column
COMMENT ON COLUMN api.patients.gender IS 'Patient gender information - optional field for providing appropriate care';

-- Create index on gender for potential future analytics (optional)
CREATE INDEX idx_patients_gender ON api.patients(gender) WHERE gender IS NOT NULL;

-- Update existing patients to have NULL gender (which is acceptable for optional field)
-- No data migration needed as this is a new optional field