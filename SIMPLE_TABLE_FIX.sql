-- SIMPLE TABLE FIX - Just the essentials without functions
-- Run this in Supabase SQL Editor

-- Create the table if it doesn't exist
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

-- Grant permissions
GRANT ALL ON api.patient_files TO authenticated;
GRANT ALL ON api.patient_files TO service_role;
GRANT USAGE ON SCHEMA api TO authenticated;
GRANT USAGE ON SCHEMA api TO service_role;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_patient_files_patient_id ON api.patient_files(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_files_file_type ON api.patient_files(file_type);

-- Enable RLS
ALTER TABLE api.patient_files ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view patient files" ON api.patient_files;
DROP POLICY IF EXISTS "Staff can upload patient files" ON api.patient_files;
DROP POLICY IF EXISTS "Staff can delete patient files" ON api.patient_files;

-- Create simple policies
CREATE POLICY "Users can view patient files" ON api.patient_files
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Staff can upload patient files" ON api.patient_files
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Staff can delete patient files" ON api.patient_files
FOR DELETE TO authenticated
USING (true);