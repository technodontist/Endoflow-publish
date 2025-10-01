-- =====================================================
-- TOOTH DIAGNOSES SCHEMA FIXES - CORRECTED VERSION
-- =====================================================
-- Run this script in Supabase SQL Editor to fix tooth_diagnoses table issues

-- 1. Check if tooth_diagnoses table exists and get current schema
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'api' AND table_name = 'tooth_diagnoses') THEN
        RAISE NOTICE 'tooth_diagnoses table does not exist. Creating it now...';
        
        -- Create the table with correct schema
        CREATE TABLE api.tooth_diagnoses (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            consultation_id UUID REFERENCES api.consultations(id) ON DELETE CASCADE,
            patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            tooth_number TEXT NOT NULL,

            -- Tooth Status
            status TEXT NOT NULL DEFAULT 'healthy' CHECK (status IN (
                'healthy', 'caries', 'filled', 'crown', 'missing',
                'attention', 'root_canal', 'extraction_needed', 'implant'
            )),

            -- Diagnosis Details
            primary_diagnosis TEXT,
            diagnosis_details TEXT,
            symptoms TEXT, -- Store as TEXT (JSON string) for compatibility

            -- Treatment Information
            recommended_treatment TEXT,
            treatment_priority TEXT DEFAULT 'medium' CHECK (treatment_priority IN (
                'urgent', 'high', 'medium', 'low', 'routine'
            )),
            treatment_details TEXT,
            estimated_duration INTEGER, -- in minutes
            estimated_cost TEXT, -- Store as TEXT to match frontend expectations

            -- Visual Properties
            color_code TEXT DEFAULT '#22c55e', -- Green for healthy

            -- Scheduling
            scheduled_date DATE,
            follow_up_required BOOLEAN DEFAULT FALSE,

            -- Metadata
            examination_date DATE DEFAULT CURRENT_DATE,
            notes TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_tooth_diagnoses_consultation_id ON api.tooth_diagnoses(consultation_id);
        CREATE INDEX IF NOT EXISTS idx_tooth_diagnoses_patient_id ON api.tooth_diagnoses(patient_id);
        CREATE INDEX IF NOT EXISTS idx_tooth_diagnoses_tooth_number ON api.tooth_diagnoses(tooth_number);
        CREATE INDEX IF NOT EXISTS idx_tooth_diagnoses_status ON api.tooth_diagnoses(status);
        CREATE INDEX IF NOT EXISTS idx_tooth_diagnoses_examination_date ON api.tooth_diagnoses(examination_date);
        
        -- Enable RLS
        ALTER TABLE api.tooth_diagnoses ENABLE ROW LEVEL SECURITY;
        
        RAISE NOTICE 'tooth_diagnoses table created successfully.';
    ELSE
        RAISE NOTICE 'tooth_diagnoses table already exists. Checking for necessary updates...';
    END IF;
END $$;

-- 2. Check current column data types and display them
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'api' 
AND table_name = 'tooth_diagnoses'
ORDER BY ordinal_position;

-- 3. Fix symptoms column data type if it's wrong
DO $$
BEGIN
    -- Check if symptoms column is TEXT[] and change to TEXT
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'api' 
        AND table_name = 'tooth_diagnoses' 
        AND column_name = 'symptoms' 
        AND data_type = 'ARRAY'
    ) THEN
        RAISE NOTICE 'Converting symptoms column from TEXT[] to TEXT...';
        
        -- First backup any existing data
        ALTER TABLE api.tooth_diagnoses ADD COLUMN symptoms_backup TEXT;
        UPDATE api.tooth_diagnoses SET symptoms_backup = array_to_string(symptoms, ',') WHERE symptoms IS NOT NULL;
        
        -- Drop the old column and recreate as TEXT
        ALTER TABLE api.tooth_diagnoses DROP COLUMN symptoms;
        ALTER TABLE api.tooth_diagnoses ADD COLUMN symptoms TEXT;
        
        -- Restore data if any
        UPDATE api.tooth_diagnoses SET symptoms = symptoms_backup WHERE symptoms_backup IS NOT NULL;
        ALTER TABLE api.tooth_diagnoses DROP COLUMN symptoms_backup;
        
        RAISE NOTICE 'symptoms column converted to TEXT successfully.';
    END IF;
END $$;

-- 4. Fix estimated_cost column data type to TEXT
DO $$
BEGIN
    -- Check if estimated_cost is numeric and change to TEXT
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'api' 
        AND table_name = 'tooth_diagnoses' 
        AND column_name = 'estimated_cost' 
        AND data_type = 'numeric'
    ) THEN
        RAISE NOTICE 'Converting estimated_cost column from NUMERIC to TEXT...';
        ALTER TABLE api.tooth_diagnoses ALTER COLUMN estimated_cost TYPE TEXT USING estimated_cost::TEXT;
        RAISE NOTICE 'estimated_cost column converted to TEXT successfully.';
    END IF;
END $$;

-- 5. Make consultation_id nullable to allow saving without consultation context
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'api' 
        AND table_name = 'tooth_diagnoses' 
        AND column_name = 'consultation_id' 
        AND is_nullable = 'NO'
    ) THEN
        RAISE NOTICE 'Making consultation_id nullable...';
        ALTER TABLE api.tooth_diagnoses ALTER COLUMN consultation_id DROP NOT NULL;
        RAISE NOTICE 'consultation_id is now nullable.';
    END IF;
END $$;

-- 6. Create or replace RLS policies
DROP POLICY IF EXISTS "Staff can manage tooth diagnoses" ON api.tooth_diagnoses;
DROP POLICY IF EXISTS "Patients can view their tooth diagnoses" ON api.tooth_diagnoses;

-- Staff can manage tooth diagnoses
CREATE POLICY "Staff can manage tooth diagnoses" ON api.tooth_diagnoses
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('assistant', 'dentist')
            AND status = 'active'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('assistant', 'dentist')
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
            AND role IN ('assistant', 'dentist')
            AND status = 'active'
        )
    );

-- 7. Create updated_at trigger if it doesn't exist
DROP TRIGGER IF EXISTS update_tooth_diagnoses_updated_at ON api.tooth_diagnoses;

CREATE TRIGGER update_tooth_diagnoses_updated_at
    BEFORE UPDATE ON api.tooth_diagnoses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. Create a dynamic function that adapts to actual column types
CREATE OR REPLACE FUNCTION api.get_latest_tooth_diagnoses(patient_uuid UUID)
RETURNS TABLE (
    tooth_number TEXT,
    status TEXT,
    primary_diagnosis TEXT,
    diagnosis_details TEXT,
    symptoms TEXT,
    recommended_treatment TEXT,
    treatment_priority TEXT,
    treatment_details TEXT,
    estimated_duration INTEGER,
    estimated_cost TEXT,
    color_code TEXT,
    scheduled_date DATE,
    follow_up_required BOOLEAN,
    examination_date DATE,
    notes TEXT,
    consultation_id UUID,
    patient_id UUID,
    id UUID,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH latest_diagnoses AS (
        SELECT DISTINCT ON (td.tooth_number) 
            td.tooth_number,
            td.status,
            td.primary_diagnosis,
            td.diagnosis_details,
            td.symptoms,
            td.recommended_treatment,
            td.treatment_priority,
            td.treatment_details,
            td.estimated_duration,
            CASE 
                WHEN td.estimated_cost IS NULL THEN NULL::TEXT
                ELSE td.estimated_cost::TEXT
            END as estimated_cost,
            td.color_code,
            td.scheduled_date,
            td.follow_up_required,
            td.examination_date,
            td.notes,
            td.consultation_id,
            td.patient_id,
            td.id,
            td.created_at,
            td.updated_at
        FROM api.tooth_diagnoses td
        WHERE td.patient_id = patient_uuid
        ORDER BY td.tooth_number, td.examination_date DESC, td.created_at DESC
    )
    SELECT 
        ld.tooth_number,
        ld.status,
        ld.primary_diagnosis,
        ld.diagnosis_details,
        ld.symptoms,
        ld.recommended_treatment,
        ld.treatment_priority,
        ld.treatment_details,
        ld.estimated_duration,
        ld.estimated_cost,
        ld.color_code,
        ld.scheduled_date,
        ld.follow_up_required,
        ld.examination_date,
        ld.notes,
        ld.consultation_id,
        ld.patient_id,
        ld.id,
        ld.created_at,
        ld.updated_at
    FROM latest_diagnoses ld
    ORDER BY ld.tooth_number;
END;
$$;

-- 9. Grant necessary permissions
GRANT USAGE ON SCHEMA api TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON api.tooth_diagnoses TO authenticated;
GRANT EXECUTE ON FUNCTION api.get_latest_tooth_diagnoses(UUID) TO authenticated;

-- 10. Test the function
SELECT 'Testing function...' as status;
-- This should work now without errors
SELECT * FROM api.get_latest_tooth_diagnoses('00000000-0000-0000-0000-000000000000'::UUID) LIMIT 1;

-- 11. Final verification
SELECT 'Schema Fix Complete!' as status;

-- Check table structure after all fixes
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'api' 
AND table_name = 'tooth_diagnoses'
ORDER BY ordinal_position;

-- Check if function was created
SELECT EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_schema = 'api' 
    AND routine_name = 'get_latest_tooth_diagnoses'
) as latest_diagnoses_function_exists;