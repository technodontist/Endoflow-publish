-- =====================================================
-- SIMPLE TOOTH DIAGNOSES FIX
-- =====================================================
-- This script first checks your actual database schema and then creates compatible functions

-- STEP 1: Check what currently exists
SELECT 'STEP 1: Checking current schema...' as status;

-- Check if tooth_diagnoses table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'api' 
    AND table_name = 'tooth_diagnoses'
) as tooth_diagnoses_table_exists;

-- If table exists, show current structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'api' 
AND table_name = 'tooth_diagnoses'
ORDER BY ordinal_position;

-- STEP 2: Create table if it doesn't exist (with correct types from the start)
CREATE TABLE IF NOT EXISTS api.tooth_diagnoses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id UUID REFERENCES api.consultations(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tooth_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'healthy' CHECK (status IN (
        'healthy', 'caries', 'filled', 'crown', 'missing',
        'attention', 'root_canal', 'extraction_needed', 'implant'
    )),
    primary_diagnosis TEXT,
    diagnosis_details TEXT,
    symptoms TEXT,
    recommended_treatment TEXT,
    treatment_priority TEXT DEFAULT 'medium' CHECK (treatment_priority IN (
        'urgent', 'high', 'medium', 'low', 'routine'
    )),
    treatment_details TEXT,
    estimated_duration INTEGER,
    estimated_cost TEXT,
    color_code TEXT DEFAULT '#22c55e',
    scheduled_date DATE,
    follow_up_required BOOLEAN DEFAULT FALSE,
    examination_date DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- STEP 3: Enable RLS if not already enabled
ALTER TABLE api.tooth_diagnoses ENABLE ROW LEVEL SECURITY;

-- STEP 4: Fix data type issues step by step

-- Fix estimated_cost if it's numeric
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'api' 
        AND table_name = 'tooth_diagnoses' 
        AND column_name = 'estimated_cost' 
        AND data_type = 'numeric'
    ) THEN
        ALTER TABLE api.tooth_diagnoses ALTER COLUMN estimated_cost TYPE TEXT USING estimated_cost::TEXT;
        RAISE NOTICE 'Fixed estimated_cost column type to TEXT';
    END IF;
END $$;

-- Fix symptoms if it's an array
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'api' 
        AND table_name = 'tooth_diagnoses' 
        AND column_name = 'symptoms' 
        AND data_type = 'ARRAY'
    ) THEN
        -- Add new column
        ALTER TABLE api.tooth_diagnoses ADD COLUMN symptoms_new TEXT;
        -- Convert existing data
        UPDATE api.tooth_diagnoses SET symptoms_new = array_to_string(symptoms, ',') WHERE symptoms IS NOT NULL;
        -- Drop old and rename new
        ALTER TABLE api.tooth_diagnoses DROP COLUMN symptoms;
        ALTER TABLE api.tooth_diagnoses RENAME COLUMN symptoms_new TO symptoms;
        RAISE NOTICE 'Fixed symptoms column type to TEXT';
    END IF;
END $$;

-- Make consultation_id nullable
ALTER TABLE api.tooth_diagnoses ALTER COLUMN consultation_id DROP NOT NULL;

-- STEP 5: Create indexes
CREATE INDEX IF NOT EXISTS idx_tooth_diagnoses_patient_id ON api.tooth_diagnoses(patient_id);
CREATE INDEX IF NOT EXISTS idx_tooth_diagnoses_tooth_number ON api.tooth_diagnoses(tooth_number);
CREATE INDEX IF NOT EXISTS idx_tooth_diagnoses_examination_date ON api.tooth_diagnoses(examination_date);
CREATE INDEX IF NOT EXISTS idx_tooth_diagnoses_status ON api.tooth_diagnoses(status);

-- STEP 6: Create simple RLS policies
DROP POLICY IF EXISTS "Staff can manage tooth diagnoses" ON api.tooth_diagnoses;
DROP POLICY IF EXISTS "Patients can view their tooth diagnoses" ON api.tooth_diagnoses;

CREATE POLICY "Staff can manage tooth diagnoses" ON api.tooth_diagnoses
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('assistant', 'dentist')
            AND status = 'active'
        )
    );

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

-- STEP 7: Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_tooth_diagnoses_updated_at ON api.tooth_diagnoses;
CREATE TRIGGER update_tooth_diagnoses_updated_at
    BEFORE UPDATE ON api.tooth_diagnoses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- STEP 8: Grant permissions
GRANT USAGE ON SCHEMA api TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON api.tooth_diagnoses TO authenticated;

-- STEP 9: Simple view instead of problematic function
CREATE OR REPLACE VIEW api.latest_tooth_diagnoses AS
WITH ranked_diagnoses AS (
    SELECT *,
           ROW_NUMBER() OVER (
               PARTITION BY patient_id, tooth_number 
               ORDER BY examination_date DESC, created_at DESC
           ) as rn
    FROM api.tooth_diagnoses
)
SELECT 
    patient_id,
    tooth_number,
    status,
    primary_diagnosis,
    diagnosis_details,
    symptoms,
    recommended_treatment,
    treatment_priority,
    treatment_details,
    estimated_duration,
    estimated_cost,
    color_code,
    scheduled_date,
    follow_up_required,
    examination_date,
    notes,
    consultation_id,
    id,
    created_at,
    updated_at
FROM ranked_diagnoses 
WHERE rn = 1;

-- Grant access to the view
GRANT SELECT ON api.latest_tooth_diagnoses TO authenticated;

-- STEP 10: Test queries
SELECT 'STEP 10: Testing setup...' as status;

-- Show final table structure
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'api' 
AND table_name = 'tooth_diagnoses'
ORDER BY ordinal_position;

-- Test the view (should work without errors)
SELECT COUNT(*) as total_diagnoses FROM api.tooth_diagnoses;
SELECT COUNT(*) as latest_diagnoses FROM api.latest_tooth_diagnoses;

SELECT 'Setup complete! You can now use the api.latest_tooth_diagnoses view to get the latest tooth diagnosis for each tooth per patient.' as final_status;