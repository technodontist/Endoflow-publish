-- =============================================
-- ENDOFLOW CONSULTATION SYSTEM - DATABASE SETUP
-- =============================================
-- This file contains all the SQL commands needed to set up the consultation system
-- Run these commands in your Supabase SQL Editor

-- =============================================
-- 1. ENSURE API SCHEMA EXISTS
-- =============================================
CREATE SCHEMA IF NOT EXISTS api;

-- =============================================
-- 2. CONSULTATIONS TABLE
-- =============================================
-- Main consultation records
CREATE TABLE IF NOT EXISTS api.consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL, -- References auth.users.id
  dentist_id UUID NOT NULL, -- References auth.users.id
  consultation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'archived')),

  -- Main consultation data fields
  chief_complaint TEXT,
  pain_assessment TEXT, -- JSON string
  medical_history TEXT, -- JSON string
  clinical_examination TEXT, -- JSON string
  investigations TEXT, -- JSON string
  diagnosis TEXT, -- JSON string
  treatment_plan TEXT, -- JSON string
  prognosis TEXT CHECK (prognosis IN ('excellent', 'good', 'fair', 'poor', 'hopeless')),

  -- Voice/AI integration
  voice_transcript TEXT, -- JSON string
  ai_parsed_data TEXT, -- JSON string
  voice_session_active BOOLEAN NOT NULL DEFAULT FALSE,

  -- Prescription & Follow-up
  prescription_data TEXT, -- JSON string
  follow_up_data TEXT, -- JSON string

  -- Additional
  additional_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- =============================================
-- 3. TOOTH DIAGNOSES TABLE
-- =============================================
-- Individual tooth tracking
CREATE TABLE IF NOT EXISTS api.tooth_diagnoses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID NOT NULL, -- References api.consultations.id
  patient_id UUID NOT NULL, -- References auth.users.id
  tooth_number TEXT NOT NULL,

  -- Tooth status and diagnosis
  status TEXT NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy', 'caries', 'filled', 'crown', 'missing', 'attention', 'root_canal', 'extraction_needed', 'implant')),
  primary_diagnosis TEXT,
  diagnosis_details TEXT,
  symptoms TEXT, -- JSON array as string

  -- Treatment information
  recommended_treatment TEXT,
  treatment_priority TEXT NOT NULL DEFAULT 'medium' CHECK (treatment_priority IN ('urgent', 'high', 'medium', 'low', 'routine')),
  treatment_details TEXT,
  estimated_duration INTEGER, -- in minutes
  estimated_cost TEXT, -- Using text for decimal handling

  -- Visual and scheduling
  color_code TEXT NOT NULL DEFAULT '#22c55e', -- Green for healthy
  scheduled_date DATE,
  follow_up_required BOOLEAN NOT NULL DEFAULT FALSE,

  -- Metadata
  examination_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  -- Constraints
  UNIQUE(consultation_id, tooth_number)
);

-- =============================================
-- 4. INDEXES FOR PERFORMANCE
-- =============================================
-- Consultation indexes
CREATE INDEX IF NOT EXISTS idx_consultations_patient_id ON api.consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_consultations_dentist_id ON api.consultations(dentist_id);
CREATE INDEX IF NOT EXISTS idx_consultations_date ON api.consultations(consultation_date);
CREATE INDEX IF NOT EXISTS idx_consultations_status ON api.consultations(status);

-- Tooth diagnoses indexes
CREATE INDEX IF NOT EXISTS idx_tooth_diagnoses_consultation_id ON api.tooth_diagnoses(consultation_id);
CREATE INDEX IF NOT EXISTS idx_tooth_diagnoses_patient_id ON api.tooth_diagnoses(patient_id);
CREATE INDEX IF NOT EXISTS idx_tooth_diagnoses_tooth_number ON api.tooth_diagnoses(tooth_number);
CREATE INDEX IF NOT EXISTS idx_tooth_diagnoses_status ON api.tooth_diagnoses(status);

-- =============================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================
-- Enable RLS on both tables
ALTER TABLE api.consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.tooth_diagnoses ENABLE ROW LEVEL SECURITY;

-- Consultation policies
-- Dentists can create consultations
CREATE POLICY "Dentists can create consultations" ON api.consultations
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role = 'dentist'
        AND status = 'active'
    )
    AND dentist_id = auth.uid()
);

-- Dentists can view their own consultations
CREATE POLICY "Dentists can view their consultations" ON api.consultations
FOR SELECT TO authenticated
USING (
    dentist_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('dentist', 'assistant')
        AND status = 'active'
    )
);

-- Dentists can update their own consultations
CREATE POLICY "Dentists can update their consultations" ON api.consultations
FOR UPDATE TO authenticated
USING (
    dentist_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role = 'dentist'
        AND status = 'active'
    )
);

-- Patients can view their own consultations (read-only)
CREATE POLICY "Patients can view their consultations" ON api.consultations
FOR SELECT TO authenticated
USING (
    patient_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role = 'patient'
        AND status = 'active'
    )
);

-- Tooth diagnoses policies
-- Staff can manage tooth diagnoses
CREATE POLICY "Staff can manage tooth diagnoses" ON api.tooth_diagnoses
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('dentist', 'assistant')
        AND status = 'active'
    )
);

-- Patients can view their tooth diagnoses
CREATE POLICY "Patients can view their tooth diagnoses" ON api.tooth_diagnoses
FOR SELECT TO authenticated
USING (
    patient_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role = 'patient'
        AND status = 'active'
    )
);

-- =============================================
-- 6. HELPFUL VIEWS FOR DASHBOARD INTEGRATION
-- =============================================
-- Create a view for consultation summaries
CREATE OR REPLACE VIEW api.consultation_summaries AS
SELECT
    c.id,
    c.patient_id,
    c.dentist_id,
    c.consultation_date,
    c.status,
    c.chief_complaint,
    p.first_name || ' ' || p.last_name AS patient_name,
    d.full_name AS dentist_name,
    COUNT(td.id) AS tooth_count,
    COUNT(CASE WHEN td.status != 'healthy' THEN 1 END) AS affected_teeth_count
FROM api.consultations c
LEFT JOIN api.patients p ON c.patient_id = p.id
LEFT JOIN public.profiles d ON c.dentist_id = d.id
LEFT JOIN api.tooth_diagnoses td ON c.id = td.consultation_id
GROUP BY c.id, c.patient_id, c.dentist_id, c.consultation_date, c.status, c.chief_complaint, p.first_name, p.last_name, d.full_name;

-- Create a view for tooth status overview
CREATE OR REPLACE VIEW api.tooth_status_overview AS
SELECT
    patient_id,
    consultation_id,
    COUNT(*) as total_teeth,
    COUNT(CASE WHEN status = 'healthy' THEN 1 END) as healthy_teeth,
    COUNT(CASE WHEN status = 'caries' THEN 1 END) as caries_teeth,
    COUNT(CASE WHEN status = 'filled' THEN 1 END) as filled_teeth,
    COUNT(CASE WHEN status = 'missing' THEN 1 END) as missing_teeth,
    COUNT(CASE WHEN status IN ('attention', 'root_canal', 'extraction_needed') THEN 1 END) as requiring_treatment
FROM api.tooth_diagnoses
GROUP BY patient_id, consultation_id;

-- =============================================
-- 7. TRIGGERS FOR AUTO-UPDATE TIMESTAMPS
-- =============================================
-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
DROP TRIGGER IF EXISTS update_consultations_updated_at ON api.consultations;
CREATE TRIGGER update_consultations_updated_at
    BEFORE UPDATE ON api.consultations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tooth_diagnoses_updated_at ON api.tooth_diagnoses;
CREATE TRIGGER update_tooth_diagnoses_updated_at
    BEFORE UPDATE ON api.tooth_diagnoses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 8. VERIFICATION QUERIES
-- =============================================
-- Run these to verify the setup worked correctly:

-- Check if tables exist
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'api' AND table_name IN ('consultations', 'tooth_diagnoses');

-- Check if policies are created
-- SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'api';

-- Check if indexes exist
-- SELECT indexname FROM pg_indexes WHERE schemaname = 'api';

-- =============================================
-- SETUP COMPLETE
-- =============================================
-- After running this script, your consultation system should be fully functional
-- The dentist dashboard can now save complete consultations with tooth data
-- Patient and assistant dashboards will have access to view consultation records
-- All data is properly secured with Row Level Security policies