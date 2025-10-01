-- Migration: Create patient_files table
-- This table stores medical images and documents uploaded for patients

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

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_patient_files_patient_id ON api.patient_files(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_files_uploaded_by ON api.patient_files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_patient_files_file_type ON api.patient_files(file_type);
CREATE INDEX IF NOT EXISTS idx_patient_files_created_at ON api.patient_files(created_at);

-- Add RLS (Row Level Security) policies
ALTER TABLE api.patient_files ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view files for patients they have access to
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

-- Policy: Only assistants and dentists can insert files
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

-- Policy: Only the uploader or other staff can update files
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

-- Policy: Only assistants and dentists can delete/archive files
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

-- Add function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION api.update_patient_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_patient_files_updated_at
    BEFORE UPDATE ON api.patient_files
    FOR EACH ROW
    EXECUTE FUNCTION api.update_patient_files_updated_at();