-- ==========================================
-- ADD FOREIGN KEY CONSTRAINTS FOR PATIENT_FILES TABLE
-- Run this in Supabase SQL Editor to fix PostgREST relationship errors
-- ==========================================

-- This fixes the error: "Could not find a relationship between 'patient_files' and 'uploaded_by' in the schema cache"
-- PostgREST requires explicit foreign key constraints to recognize table relationships

-- First, check if the table exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'api' 
        AND table_name = 'patient_files'
    ) THEN
        RAISE EXCEPTION 'Table api.patient_files does not exist. Run the table creation script first.';
    END IF;
END $$;

-- Drop existing constraints if they exist (safe operation)
ALTER TABLE api.patient_files DROP CONSTRAINT IF EXISTS fk_patient_files_uploaded_by;
ALTER TABLE api.patient_files DROP CONSTRAINT IF EXISTS fk_patient_files_patient_id;

-- Add foreign key constraint for uploaded_by -> public.profiles.id
-- This enables PostgREST to understand the relationship for joins
ALTER TABLE api.patient_files 
ADD CONSTRAINT fk_patient_files_uploaded_by 
FOREIGN KEY (uploaded_by) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- Add foreign key constraint for patient_id -> auth.users.id  
-- This ensures data integrity for patient references
ALTER TABLE api.patient_files 
ADD CONSTRAINT fk_patient_files_patient_id 
FOREIGN KEY (patient_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- Verify the constraints were created successfully
SELECT
    'FOREIGN KEY CONSTRAINTS ADDED' as status,
    tc.constraint_name,
    tc.table_schema,
    tc.table_name,
    kcu.column_name,
    ccu.table_schema AS foreign_table_schema,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'api'
    AND tc.table_name = 'patient_files'
ORDER BY tc.constraint_name;

-- Success message
SELECT 'SUCCESS: Foreign key constraints added successfully!' as result;
SELECT 'You can now use PostgREST relationship queries like: profiles!uploaded_by(id,full_name)' as next_steps;