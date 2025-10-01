-- =====================================================
-- SIMPLE DATABASE FIX FOR CONSULTATION SYSTEM
-- =====================================================
-- This script only fixes the missing view without the problematic function

-- STEP 1: Create the missing view
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
SELECT *
FROM ranked_diagnoses 
WHERE rn = 1;

-- STEP 2: Grant permissions on the view
GRANT SELECT ON api.latest_tooth_diagnoses TO authenticated;
GRANT SELECT ON api.latest_tooth_diagnoses TO service_role;

-- STEP 3: Ensure the underlying table has proper RLS
ALTER TABLE api.tooth_diagnoses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
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

-- STEP 4: Test the fix
SELECT 'Simple database fix applied successfully!' as status;

-- Test the view
SELECT COUNT(*) as total_latest_diagnoses FROM api.latest_tooth_diagnoses;

-- Test the underlying table
SELECT COUNT(*) as total_tooth_diagnoses FROM api.tooth_diagnoses;

SELECT 'Consultation system should now work without errors!' as final_result;