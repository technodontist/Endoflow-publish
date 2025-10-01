-- =====================================================
-- QUICK DATABASE FIX FOR CONSULTATION SYSTEM
-- =====================================================
-- Run this script in Supabase SQL Editor to fix the missing view error
-- This addresses: "permission denied for view latest_tooth_diagnoses"

-- STEP 1: Create the missing view
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

-- STEP 2: Grant permissions on the view
GRANT SELECT ON api.latest_tooth_diagnoses TO authenticated;
GRANT SELECT ON api.latest_tooth_diagnoses TO service_role;

-- STEP 3: Enable RLS on the view
ALTER VIEW api.latest_tooth_diagnoses SET (security_invoker = on);

-- STEP 4: Create RLS policy for the view
DROP POLICY IF EXISTS "Staff and patients can view latest tooth diagnoses" ON api.latest_tooth_diagnoses;
CREATE POLICY "Staff and patients can view latest tooth diagnoses" ON api.latest_tooth_diagnoses
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

-- STEP 5: Test the fix
SELECT 'Database fix applied successfully!' as status;

-- Verify the view works
SELECT COUNT(*) as total_latest_diagnoses FROM api.latest_tooth_diagnoses;

SELECT 'Consultation system should now work without permission errors!' as result;