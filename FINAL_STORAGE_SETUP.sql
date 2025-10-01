-- FINAL STORAGE SETUP - Run this in Supabase SQL Editor
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

-- Add foreign key constraints for PostgREST relationships
ALTER TABLE api.patient_files DROP CONSTRAINT IF EXISTS fk_patient_files_uploaded_by;
ALTER TABLE api.patient_files DROP CONSTRAINT IF EXISTS fk_patient_files_patient_id;

ALTER TABLE api.patient_files 
ADD CONSTRAINT fk_patient_files_uploaded_by 
FOREIGN KEY (uploaded_by) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

ALTER TABLE api.patient_files 
ADD CONSTRAINT fk_patient_files_patient_id 
FOREIGN KEY (patient_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

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

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing storage policies if they exist
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;

-- Create storage policies (run AFTER creating the bucket)
CREATE POLICY "Allow authenticated uploads" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'medical-files');

CREATE POLICY "Allow authenticated reads" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'medical-files');

CREATE POLICY "Allow authenticated deletes" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'medical-files');