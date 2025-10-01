-- FIX TABLE PERMISSIONS for patient_files
-- Run this in Supabase SQL Editor to fix permission issues

-- Grant necessary permissions to authenticated users and service role
GRANT ALL ON api.patient_files TO authenticated;
GRANT ALL ON api.patient_files TO service_role;

-- Grant usage on the api schema
GRANT USAGE ON SCHEMA api TO authenticated;
GRANT USAGE ON SCHEMA api TO service_role;

-- Grant permissions on the sequence (for UUID generation)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA api TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA api TO service_role;

-- Ensure RLS is enabled
ALTER TABLE api.patient_files ENABLE ROW LEVEL SECURITY;

-- Re-create policies to ensure they're working
DROP POLICY IF EXISTS "Users can view patient files" ON api.patient_files;
DROP POLICY IF EXISTS "Staff can upload patient files" ON api.patient_files;
DROP POLICY IF EXISTS "Staff can delete patient files" ON api.patient_files;

-- Policy for viewing files
CREATE POLICY "Users can view patient files" ON api.patient_files
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

-- Policy for inserting files
CREATE POLICY "Staff can upload patient files" ON api.patient_files
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('assistant', 'dentist')
        AND status = 'active'
    )
    AND uploaded_by = auth.uid()
);

-- Policy for deleting files
CREATE POLICY "Staff can delete patient files" ON api.patient_files
FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('assistant', 'dentist')
        AND status = 'active'
    )
);

-- Grant permissions on functions
GRANT EXECUTE ON FUNCTION api.update_patient_files_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION api.update_patient_files_updated_at() TO service_role;