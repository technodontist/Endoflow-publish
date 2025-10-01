-- Migration: Enhance treatments table for appointment linkage and multi-visit tracking
-- Adds linkage to consultation, tooth, and tooth diagnosis. Adds progress fields.

ALTER TABLE IF EXISTS api.treatments
  ADD COLUMN IF NOT EXISTS tooth_number TEXT,
  ADD COLUMN IF NOT EXISTS tooth_diagnosis_id UUID REFERENCES api.tooth_diagnoses(id),
  ADD COLUMN IF NOT EXISTS consultation_id UUID REFERENCES api.consultations(id),
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS total_visits INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS completed_visits INTEGER DEFAULT 0;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_treatments_patient_id ON api.treatments(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatments_appointment_id ON api.treatments(appointment_id);
CREATE INDEX IF NOT EXISTS idx_treatments_status ON api.treatments(status);
CREATE INDEX IF NOT EXISTS idx_treatments_tooth_diagnosis_id ON api.treatments(tooth_diagnosis_id);

-- Optional: keep RLS consistent (if not already enabled)
-- ALTER TABLE api.treatments ENABLE ROW LEVEL SECURITY;
-- Policies should already exist; if not, they can mirror appointments/consultations policies.
