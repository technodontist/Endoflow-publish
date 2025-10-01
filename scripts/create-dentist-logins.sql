-- =============================================
-- ENDOFLOW: Create Actual Dentist Login Credentials
-- =============================================
-- This script updates the mock dentists with proper login credentials
-- Run this in Supabase SQL Editor AFTER running seed-test-dentists.sql

-- Update the auth.users entries with proper encrypted passwords
-- Password for all test accounts: "EndoFlow2024!"
-- Encrypted with bcrypt: $2a$10$YourActualBcryptHashHere

UPDATE auth.users
SET encrypted_password = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'  -- "password"
WHERE email IN (
  'sarah.wilson@endoflow.com',
  'michael.chen@endoflow.com',
  'emily.rodriguez@endoflow.com'
);

-- Verify the update
SELECT email, encrypted_password, email_confirmed_at
FROM auth.users
WHERE email LIKE '%@endoflow.com';

-- NOTE: All test dentists can now login with:
-- Email: sarah.wilson@endoflow.com, Password: password
-- Email: michael.chen@endoflow.com, Password: password
-- Email: emily.rodriguez@endoflow.com, Password: password