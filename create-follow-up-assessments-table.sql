-- Create follow_up_assessments table for comprehensive follow-up tracking
-- This integrates with the contextual appointment system

DROP TABLE IF EXISTS api.follow_up_assessments CASCADE;

CREATE TABLE api.follow_up_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Core appointment linkage
    appointment_id UUID NOT NULL REFERENCES api.appointments(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    treatment_id UUID REFERENCES api.treatments(id) ON DELETE SET NULL,
    consultation_id UUID REFERENCES api.consultations(id) ON DELETE SET NULL,

    -- Assessment metadata
    assessment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES auth.users(id),

    -- Clinical assessment fields
    symptom_status TEXT CHECK (symptom_status IN ('resolved', 'improved', 'same', 'worsened')),
    pain_level INTEGER CHECK (pain_level >= 0 AND pain_level <= 10),
    swelling TEXT CHECK (swelling IN ('none', 'mild', 'moderate', 'severe')),
    healing_progress TEXT CHECK (healing_progress IN ('excellent', 'normal', 'delayed', 'concerning')),

    -- Comprehensive clinical data (JSONB for flexibility)
    clinical_data JSONB DEFAULT '{}',

    -- Tooth linkage
    linked_teeth TEXT[], -- Array of tooth numbers

    -- Next steps
    next_follow_up_date DATE,
    additional_treatment_needed BOOLEAN DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_follow_up_assessments_appointment_id ON api.follow_up_assessments(appointment_id);
CREATE INDEX idx_follow_up_assessments_patient_id ON api.follow_up_assessments(patient_id);
CREATE INDEX idx_follow_up_assessments_treatment_id ON api.follow_up_assessments(treatment_id);
CREATE INDEX idx_follow_up_assessments_consultation_id ON api.follow_up_assessments(consultation_id);
CREATE INDEX idx_follow_up_assessments_assessment_date ON api.follow_up_assessments(assessment_date);

-- RLS policies
ALTER TABLE api.follow_up_assessments ENABLE ROW LEVEL SECURITY;

-- Policy: Staff can insert follow-up assessments
CREATE POLICY "Staff can create follow-up assessments" ON api.follow_up_assessments
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('assistant', 'dentist')
            AND status = 'active'
        )
        AND created_by = auth.uid()
    );

-- Policy: Users can view assessments (patients see own, staff see all)
CREATE POLICY "Users can view follow-up assessments" ON api.follow_up_assessments
    FOR SELECT TO authenticated
    USING (
        patient_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('assistant', 'dentist')
            AND status = 'active'
        )
    );

-- Policy: Staff can update assessments they created
CREATE POLICY "Staff can update own follow-up assessments" ON api.follow_up_assessments
    FOR UPDATE TO authenticated
    USING (
        created_by = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('assistant', 'dentist')
            AND status = 'active'
        )
    );

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_follow_up_assessments_updated_at
    BEFORE UPDATE ON api.follow_up_assessments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add helpful comments
COMMENT ON TABLE api.follow_up_assessments IS 'Comprehensive follow-up assessment data linked to appointments, treatments, and consultations';
COMMENT ON COLUMN api.follow_up_assessments.clinical_data IS 'Flexible JSONB field for storing detailed clinical findings, wound status, medication adherence, etc.';
COMMENT ON COLUMN api.follow_up_assessments.linked_teeth IS 'Array of tooth numbers that this follow-up assessment relates to';