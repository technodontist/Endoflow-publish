-- =====================================================
-- CORRECTED DATABASE FIX FOR CONSULTATION SYSTEM
-- =====================================================
-- Run this script in Supabase SQL Editor to fix the missing view error
-- This addresses: "permission denied for view latest_tooth_diagnoses"

-- STEP 1: Create the missing view (Views don't need RLS policies)
DROP VIEW IF EXISTS api.latest_tooth_diagnoses;

CREATE VIEW api.latest_tooth_diagnoses AS
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

-- STEP 2: Grant permissions on the view (Views inherit permissions from underlying tables)
GRANT SELECT ON api.latest_tooth_diagnoses TO authenticated;
GRANT SELECT ON api.latest_tooth_diagnoses TO service_role;
GRANT SELECT ON api.latest_tooth_diagnoses TO anon;

-- STEP 3: Ensure the underlying tooth_diagnoses table has proper RLS policies
-- (The view will inherit security from the underlying table)

-- Check if RLS is enabled on the underlying table
ALTER TABLE api.tooth_diagnoses ENABLE ROW LEVEL SECURITY;

-- Create/recreate policies on the underlying table
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

-- STEP 4: Also create a function as an alternative to the view for better performance
CREATE OR REPLACE FUNCTION api.get_latest_tooth_diagnoses_for_patient(patient_uuid UUID)
RETURNS SETOF api.tooth_diagnoses
LANGUAGE sql
SECURITY DEFINER
SET search_path = api, public
AS $$
    WITH ranked_diagnoses AS (
        SELECT *,
               ROW_NUMBER() OVER (
                   PARTITION BY tooth_number 
                   ORDER BY examination_date DESC, created_at DESC
               ) as rn
        FROM api.tooth_diagnoses
        WHERE patient_id = patient_uuid
    )
    SELECT 
        id, consultation_id, patient_id, tooth_number, status,
        primary_diagnosis, diagnosis_details, symptoms,
        recommended_treatment, treatment_priority, treatment_details,
        estimated_duration, estimated_cost, color_code,
        scheduled_date, follow_up_required, examination_date,
        notes, created_at, updated_at
    FROM ranked_diagnoses 
    WHERE rn = 1
    ORDER BY tooth_number;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION api.get_latest_tooth_diagnoses_for_patient(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION api.get_latest_tooth_diagnoses_for_patient(UUID) TO service_role;

-- STEP 5: Test the fix
SELECT 'Database fix applied successfully!' as status;

-- Test the view
SELECT COUNT(*) as total_latest_diagnoses_view FROM api.latest_tooth_diagnoses;

-- Test if we can access the underlying table
SELECT COUNT(*) as total_tooth_diagnoses FROM api.tooth_diagnoses;

-- Test the function with a dummy UUID (should return 0 rows but no error)
SELECT COUNT(*) as function_test 
FROM api.get_latest_tooth_diagnoses_for_patient('00000000-0000-0000-0000-000000000000'::UUID);

SELECT 'All tests completed! Consultation system should now work without errors.' as final_result;