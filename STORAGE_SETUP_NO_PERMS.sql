-- STORAGE SETUP - Works without owner permissions on storage.objects
-- STEP 1: Create bucket manually in Dashboard first, then run this SQL

-- Create patient_files table if it doesn't exist
CREATE TABLE IF NOT EXISTS api.patient_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    uploaded_by UUID NOT NULL,
    file_name TEXT NOT NULL,
    original_file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    file_type TEXT NOT NULL,
    description TEXT NOT NULL,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_patient_files_patient_id ON api.patient_files(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_files_file_type ON api.patient_files(file_type);

-- Enable RLS on patient_files table
ALTER TABLE api.patient_files ENABLE ROW LEVEL SECURITY;

-- Drop existing table policies if they exist
DROP POLICY IF EXISTS "Users can view patient files" ON api.patient_files;
DROP POLICY IF EXISTS "Staff can upload patient files" ON api.patient_files;
DROP POLICY IF EXISTS "Staff can delete patient files" ON api.patient_files;

-- Create table policies
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

-- Note: Storage policies will be automatically created by Supabase
-- when you create the bucket with these settings:
-- 1. Go to Storage in Dashboard
-- 2. Create bucket named "medical-files"
-- 3. Set to Private
-- 4. Supabase will automatically set up basic authenticated access policies