-- Migration: Create patient_files table (Safe version - handles existing policies)
-- This table stores medical images and documents uploaded for patients

-- Create table (safe if already exists)
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

-- Add indexes for better query performance (safe if already exists)
CREATE INDEX IF NOT EXISTS idx_patient_files_patient_id ON api.patient_files(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_files_uploaded_by ON api.patient_files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_patient_files_file_type ON api.patient_files(file_type);
CREATE INDEX IF NOT EXISTS idx_patient_files_created_at ON api.patient_files(created_at);

-- Enable RLS (safe if already enabled)
ALTER TABLE api.patient_files ENABLE ROW LEVEL SECURITY;

-- Add foreign key constraints (safe if already exist)
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

-- Drop existing policies first (safe if they don't exist)
DROP POLICY IF EXISTS "Users can view patient files" ON api.patient_files;
DROP POLICY IF EXISTS "Staff can upload patient files" ON api.patient_files;
DROP POLICY IF EXISTS "Staff can update patient files" ON api.patient_files;
DROP POLICY IF EXISTS "Staff can delete patient files" ON api.patient_files;

-- Create policies fresh
CREATE POLICY "Users can view patient files" ON api.patient_files
FOR SELECT
TO authenticated
USING (
    -- Patient can view their own files
    patient_id = auth.uid()
    OR
    -- Staff (assistants/dentists) can view all patient files
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('assistant', 'dentist')
        AND status = 'active'
    )
);

CREATE POLICY "Staff can upload patient files" ON api.patient_files
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('assistant', 'dentist')
        AND status = 'active'
    )
    AND uploaded_by = auth.uid()
);

CREATE POLICY "Staff can update patient files" ON api.patient_files
FOR UPDATE
TO authenticated
USING (
    uploaded_by = auth.uid()
    OR
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('assistant', 'dentist')
        AND status = 'active'
    )
);

CREATE POLICY "Staff can delete patient files" ON api.patient_files
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('assistant', 'dentist')
        AND status = 'active'
    )
);

-- Create function for updated_at (safe if exists)
CREATE OR REPLACE FUNCTION api.update_patient_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger first (safe if doesn't exist)
DROP TRIGGER IF EXISTS update_patient_files_updated_at ON api.patient_files;

-- Create trigger for updated_at
CREATE TRIGGER update_patient_files_updated_at
    BEFORE UPDATE ON api.patient_files
    FOR EACH ROW
    EXECUTE FUNCTION api.update_patient_files_updated_at();