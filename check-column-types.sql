-- Check the actual column types for form_data
SELECT 
    table_schema,
    table_name,
    column_name,
    data_type,
    udt_name
FROM information_schema.columns 
WHERE table_name = 'pending_registrations' 
AND column_name = 'form_data';

-- Also check if the table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'api' 
    AND table_name = 'pending_registrations'
) as table_exists;