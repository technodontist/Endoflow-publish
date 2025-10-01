-- ==========================================
-- FIX FORM_DATA COLUMN TYPE IF NECESSARY
-- Run this BEFORE running fix-assistant-dashboard-permissions.sql
-- ==========================================

-- Check current column type
SELECT 
    'CURRENT COLUMN TYPE' as info,
    table_schema,
    table_name,
    column_name,
    data_type,
    udt_name
FROM information_schema.columns 
WHERE table_name = 'pending_registrations' 
AND column_name = 'form_data';

-- If the form_data column exists and is TEXT, we need to convert it to JSONB
-- This is a safe operation if the data is valid JSON

DO $$
BEGIN
    -- Check if the column exists and is text type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pending_registrations' 
        AND column_name = 'form_data' 
        AND data_type = 'text'
    ) THEN
        -- Convert text column to jsonb
        -- This will fail if any existing data is not valid JSON
        ALTER TABLE api.pending_registrations 
        ALTER COLUMN form_data TYPE JSONB USING form_data::JSONB;
        
        RAISE NOTICE 'Successfully converted form_data column from TEXT to JSONB';
    ELSE
        RAISE NOTICE 'form_data column is already JSONB or does not exist';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error converting form_data column: %', SQLERRM;
        RAISE NOTICE 'Please check that all existing data in form_data column is valid JSON';
END $$;

-- Verify the change
SELECT 
    'UPDATED COLUMN TYPE' as info,
    table_schema,
    table_name,
    column_name,
    data_type,
    udt_name
FROM information_schema.columns 
WHERE table_name = 'pending_registrations' 
AND column_name = 'form_data';