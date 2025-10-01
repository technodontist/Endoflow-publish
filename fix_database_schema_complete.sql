-- =============================================
-- ENDOFLOW: Complete Database Schema Fix
-- =============================================
-- This script fixes all database schema errors causing the PostgREST issues
-- Run this entire script in Supabase SQL Editor to fix the consultation and patient files errors
--
-- ERRORS ADDRESSED:
-- 1. Missing foreign key relationship between 'consultations' and 'dentists'  
-- 2. Missing foreign key relationship between 'patient_files' and 'profiles'
-- 3. Missing tables if they don't exist
-- 4. Missing indexes for performance

BEGIN;

-- =============================================
-- STEP 1: ENSURE API SCHEMA EXISTS
-- =============================================
CREATE SCHEMA IF NOT EXISTS api;

-- =============================================
-- STEP 2: CREATE CONSULTATIONS TABLE IF NOT EXISTS
-- =============================================
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
-- STEP 3: CREATE PATIENT_FILES TABLE IF NOT EXISTS
-- =============================================
CREATE TABLE IF NOT EXISTS api.patient_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL, -- References auth.users.id
    uploaded_by UUID NOT NULL, -- References auth.users.id (assistant/dentist who uploaded)
    file_name TEXT NOT NULL,
    original_file_name TEXT NOT NULL,
    file_path TEXT NOT NULL, -- Supabase storage path
    file_size INTEGER NOT NULL, -- in bytes
    mime_type TEXT NOT NULL,
    file_type TEXT NOT NULL, -- X-Ray, Oral Photo, etc.
    description TEXT NOT NULL, -- Legend/description of the file
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- =============================================
-- STEP 4: CREATE TOOTH_DIAGNOSES TABLE IF NOT EXISTS
-- =============================================
-- This table is referenced in consultations.ts
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
-- STEP 5: ADD FOREIGN KEY CONSTRAINTS
-- =============================================

-- Drop existing foreign keys if they exist to avoid conflicts
DO $$ 
BEGIN
    -- Drop consultations foreign keys if they exist
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_consultations_patient_id') THEN
        ALTER TABLE api.consultations DROP CONSTRAINT fk_consultations_patient_id;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_consultations_dentist_id') THEN
        ALTER TABLE api.consultations DROP CONSTRAINT fk_consultations_dentist_id;
    END IF;

    -- Drop patient_files foreign keys if they exist
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_patient_files_patient_id') THEN
        ALTER TABLE api.patient_files DROP CONSTRAINT fk_patient_files_patient_id;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_patient_files_uploaded_by') THEN
        ALTER TABLE api.patient_files DROP CONSTRAINT fk_patient_files_uploaded_by;
    END IF;

    -- Drop tooth_diagnoses foreign keys if they exist
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tooth_diagnoses_consultation_id') THEN
        ALTER TABLE api.tooth_diagnoses DROP CONSTRAINT fk_tooth_diagnoses_consultation_id;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tooth_diagnoses_patient_id') THEN
        ALTER TABLE api.tooth_diagnoses DROP CONSTRAINT fk_tooth_diagnoses_patient_id;
    END IF;
END $$;

-- Add foreign key constraints for consultations table
-- These are the CRITICAL constraints that fix the PostgREST errors
ALTER TABLE api.consultations 
ADD CONSTRAINT fk_consultations_patient_id 
FOREIGN KEY (patient_id) REFERENCES auth.users(id) 
ON DELETE CASCADE;

ALTER TABLE api.consultations 
ADD CONSTRAINT fk_consultations_dentist_id 
FOREIGN KEY (dentist_id) REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- Add foreign key constraints for patient_files table
-- This fixes the "patient_files and profiles" PostgREST error
ALTER TABLE api.patient_files 
ADD CONSTRAINT fk_patient_files_patient_id 
FOREIGN KEY (patient_id) REFERENCES auth.users(id) 
ON DELETE CASCADE;

ALTER TABLE api.patient_files 
ADD CONSTRAINT fk_patient_files_uploaded_by 
FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- Add foreign key constraints for tooth_diagnoses table
ALTER TABLE api.tooth_diagnoses 
ADD CONSTRAINT fk_tooth_diagnoses_consultation_id 
FOREIGN KEY (consultation_id) REFERENCES api.consultations(id) 
ON DELETE CASCADE;

ALTER TABLE api.tooth_diagnoses 
ADD CONSTRAINT fk_tooth_diagnoses_patient_id 
FOREIGN KEY (patient_id) REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- =============================================
-- STEP 6: CREATE INDEXES FOR PERFORMANCE
-- =============================================

-- Consultation indexes
CREATE INDEX IF NOT EXISTS idx_consultations_patient_id ON api.consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_consultations_dentist_id ON api.consultations(dentist_id);
CREATE INDEX IF NOT EXISTS idx_consultations_date ON api.consultations(consultation_date);
CREATE INDEX IF NOT EXISTS idx_consultations_status ON api.consultations(status);

-- Patient files indexes
CREATE INDEX IF NOT EXISTS idx_patient_files_patient_id ON api.patient_files(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_files_uploaded_by ON api.patient_files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_patient_files_file_type ON api.patient_files(file_type);
CREATE INDEX IF NOT EXISTS idx_patient_files_created_at ON api.patient_files(created_at);

-- Tooth diagnoses indexes
CREATE INDEX IF NOT EXISTS idx_tooth_diagnoses_consultation_id ON api.tooth_diagnoses(consultation_id);
CREATE INDEX IF NOT EXISTS idx_tooth_diagnoses_patient_id ON api.tooth_diagnoses(patient_id);
CREATE INDEX IF NOT EXISTS idx_tooth_diagnoses_tooth_number ON api.tooth_diagnoses(tooth_number);
CREATE INDEX IF NOT EXISTS idx_tooth_diagnoses_status ON api.tooth_diagnoses(status);

-- =============================================
-- STEP 7: ENABLE ROW LEVEL SECURITY
-- =============================================
ALTER TABLE api.consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.patient_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.tooth_diagnoses ENABLE ROW LEVEL SECURITY;

-- =============================================
-- STEP 8: CREATE RLS POLICIES FOR CONSULTATIONS
-- =============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "service_role_can_access_consultations" ON api.consultations;
DROP POLICY IF EXISTS "users_can_access_own_consultations" ON api.consultations;
DROP POLICY IF EXISTS "dentists_can_manage_consultations" ON api.consultations;

-- Service role has full access (for your createServiceClient calls)
CREATE POLICY "service_role_can_access_consultations" ON api.consultations
FOR ALL TO service_role USING (true);

-- Patients can view their own consultations
CREATE POLICY "users_can_access_own_consultations" ON api.consultations
FOR SELECT TO authenticated USING (
    patient_id = auth.uid() OR
    dentist_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('assistant', 'dentist') 
        AND status = 'active'
    )
);

-- Dentists can create/update consultations
CREATE POLICY "dentists_can_manage_consultations" ON api.consultations
FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role = 'dentist' 
        AND status = 'active'
    )
);

-- =============================================
-- STEP 9: CREATE RLS POLICIES FOR PATIENT_FILES
-- =============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "service_role_can_access_patient_files" ON api.patient_files;
DROP POLICY IF EXISTS "users_can_access_patient_files" ON api.patient_files;
DROP POLICY IF EXISTS "staff_can_manage_patient_files" ON api.patient_files;

-- Service role has full access
CREATE POLICY "service_role_can_access_patient_files" ON api.patient_files
FOR ALL TO service_role USING (true);

-- Users can view patient files based on their role
CREATE POLICY "users_can_access_patient_files" ON api.patient_files
FOR SELECT TO authenticated USING (
    -- Patients can view their own files
    patient_id = auth.uid() OR
    -- Staff can view all files
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('assistant', 'dentist') 
        AND status = 'active'
    )
);

-- Staff can manage patient files
CREATE POLICY "staff_can_manage_patient_files" ON api.patient_files
FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('assistant', 'dentist') 
        AND status = 'active'
    )
);

-- =============================================
-- STEP 10: CREATE RLS POLICIES FOR TOOTH_DIAGNOSES
-- =============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "service_role_can_access_tooth_diagnoses" ON api.tooth_diagnoses;
DROP POLICY IF EXISTS "users_can_access_tooth_diagnoses" ON api.tooth_diagnoses;
DROP POLICY IF EXISTS "staff_can_manage_tooth_diagnoses" ON api.tooth_diagnoses;

-- Service role has full access
CREATE POLICY "service_role_can_access_tooth_diagnoses" ON api.tooth_diagnoses
FOR ALL TO service_role USING (true);

-- Users can view tooth diagnoses based on their role
CREATE POLICY "users_can_access_tooth_diagnoses" ON api.tooth_diagnoses
FOR SELECT TO authenticated USING (
    -- Patients can view their own diagnoses
    patient_id = auth.uid() OR
    -- Staff can view all diagnoses
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('assistant', 'dentist') 
        AND status = 'active'
    )
);

-- Staff can manage tooth diagnoses
CREATE POLICY "staff_can_manage_tooth_diagnoses" ON api.tooth_diagnoses
FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('assistant', 'dentist') 
        AND status = 'active'
    )
);

-- =============================================
-- STEP 11: CREATE TRIGGERS FOR AUTO-UPDATE TIMESTAMPS
-- =============================================

-- Create or replace the update function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to all tables with updated_at columns
DROP TRIGGER IF EXISTS update_consultations_updated_at ON api.consultations;
CREATE TRIGGER update_consultations_updated_at
    BEFORE UPDATE ON api.consultations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_patient_files_updated_at ON api.patient_files;
CREATE TRIGGER update_patient_files_updated_at
    BEFORE UPDATE ON api.patient_files
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tooth_diagnoses_updated_at ON api.tooth_diagnoses;
CREATE TRIGGER update_tooth_diagnoses_updated_at
    BEFORE UPDATE ON api.tooth_diagnoses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- STEP 12: VERIFICATION AND SUCCESS MESSAGE
-- =============================================

-- Verify the fix by checking foreign key constraints
DO $$
DECLARE 
    fk_count INTEGER;
    consultation_table_exists INTEGER;
    patient_files_table_exists INTEGER;
BEGIN
    -- Count foreign keys in api schema
    SELECT COUNT(*) INTO fk_count
    FROM pg_constraint 
    WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'api')
    AND contype = 'f';
    
    -- Check tables exist
    SELECT COUNT(*) INTO consultation_table_exists
    FROM information_schema.tables 
    WHERE table_schema = 'api' AND table_name = 'consultations';
    
    SELECT COUNT(*) INTO patient_files_table_exists
    FROM information_schema.tables 
    WHERE table_schema = 'api' AND table_name = 'patient_files';
    
    -- Report results
    RAISE NOTICE '=== DATABASE SCHEMA FIX COMPLETED ===';
    RAISE NOTICE 'Consultations table: %', CASE WHEN consultation_table_exists > 0 THEN 'CREATED' ELSE 'ERROR' END;
    RAISE NOTICE 'Patient files table: %', CASE WHEN patient_files_table_exists > 0 THEN 'CREATED' ELSE 'ERROR' END;
    RAISE NOTICE 'Total foreign key constraints in api schema: %', fk_count;
    
    IF consultation_table_exists > 0 AND patient_files_table_exists > 0 AND fk_count >= 6 THEN
        RAISE NOTICE '✅ SUCCESS: All database schema errors should now be fixed!';
        RAISE NOTICE 'The PostgREST errors for consultations and patient_files should be resolved.';
    ELSE
        RAISE NOTICE '⚠️  WARNING: Some issues may remain. Please check the output above.';
    END IF;
END $$;

COMMIT;

-- Display final verification query
SELECT 
    'FINAL VERIFICATION' as status,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'api' AND table_name = 'consultations') as consultations_exists,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'api' AND table_name = 'patient_files') as patient_files_exists,
    (SELECT COUNT(*) FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'api') AND contype = 'f') as foreign_key_count;