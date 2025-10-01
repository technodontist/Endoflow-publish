-- Add follow-up tracking columns to treatments table
ALTER TABLE api.treatments 
ADD COLUMN IF NOT EXISTS follow_up_required BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS follow_up_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS last_follow_up_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS follow_up_notes JSONB;

-- Add check constraint for follow_up_status
ALTER TABLE api.treatments
DROP CONSTRAINT IF EXISTS treatments_follow_up_status_check;

ALTER TABLE api.treatments
ADD CONSTRAINT treatments_follow_up_status_check 
CHECK (follow_up_status IN ('pending', 'scheduled', 'completed', 'not_required'));

-- Create index for follow-up queries
CREATE INDEX IF NOT EXISTS idx_treatments_follow_up_required 
ON api.treatments(patient_id, follow_up_required) 
WHERE follow_up_required = true;

-- Create a dedicated follow_up_assessments table for detailed follow-up data
CREATE TABLE IF NOT EXISTS api.follow_up_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES api.appointments(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES api.patients(id) ON DELETE CASCADE,
  treatment_id UUID REFERENCES api.treatments(id) ON DELETE SET NULL,
  consultation_id UUID REFERENCES api.consultations(id) ON DELETE SET NULL,
  assessment_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Clinical Assessment
  symptom_status TEXT CHECK (symptom_status IN ('resolved', 'improved', 'same', 'worsened')),
  pain_level INTEGER CHECK (pain_level >= 0 AND pain_level <= 10),
  swelling TEXT CHECK (swelling IN ('none', 'mild', 'moderate', 'severe')),
  healing_progress TEXT CHECK (healing_progress IN ('excellent', 'normal', 'delayed', 'concerning')),
  
  -- Clinical Findings
  clinical_data JSONB NOT NULL DEFAULT '{}',
  linked_teeth INTEGER[] DEFAULT '{}',
  
  -- Next Steps
  next_follow_up_date DATE,
  additional_treatment_needed BOOLEAN DEFAULT false,
  
  -- Metadata
  created_by UUID REFERENCES api.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_follow_up_assessments_patient ON api.follow_up_assessments(patient_id);
CREATE INDEX idx_follow_up_assessments_treatment ON api.follow_up_assessments(treatment_id);
CREATE INDEX idx_follow_up_assessments_appointment ON api.follow_up_assessments(appointment_id);
CREATE INDEX idx_follow_up_assessments_date ON api.follow_up_assessments(assessment_date);

-- Add RLS policies
ALTER TABLE api.follow_up_assessments ENABLE ROW LEVEL SECURITY;

-- Dentists can view and create follow-up assessments
CREATE POLICY "Dentists can view follow-up assessments" 
ON api.follow_up_assessments FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM api.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.user_type = 'dentist'
  )
);

CREATE POLICY "Dentists can create follow-up assessments" 
ON api.follow_up_assessments FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM api.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.user_type = 'dentist'
  )
);

-- Patients can view their own follow-up assessments
CREATE POLICY "Patients can view own follow-up assessments" 
ON api.follow_up_assessments FOR SELECT 
TO authenticated 
USING (
  patient_id IN (
    SELECT id FROM api.patients 
    WHERE user_id = auth.uid()
  )
);

-- Create a function to update treatment follow-up status
CREATE OR REPLACE FUNCTION api.update_treatment_follow_up_status()
RETURNS TRIGGER AS $$
BEGIN
  -- When a follow-up assessment is created, update the treatment status
  IF NEW.treatment_id IS NOT NULL THEN
    UPDATE api.treatments
    SET 
      follow_up_status = 'completed',
      last_follow_up_date = NEW.assessment_date,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.treatment_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update treatment follow-up status
CREATE TRIGGER update_treatment_follow_up_after_assessment
AFTER INSERT ON api.follow_up_assessments
FOR EACH ROW
EXECUTE FUNCTION api.update_treatment_follow_up_status();

-- Add comment
COMMENT ON TABLE api.follow_up_assessments IS 'Stores detailed follow-up assessment data for treatment appointments';