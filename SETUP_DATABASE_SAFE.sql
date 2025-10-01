-- ==========================================
-- ENDOFLOW DATABASE SETUP SCRIPT (SAFE VERSION)
-- Run this in Supabase SQL Editor
-- ==========================================

-- Create the API schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS api;

-- Create api.assistants table
CREATE TABLE IF NOT EXISTS api.assistants (
    id UUID PRIMARY KEY,
    full_name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create api.dentists table
CREATE TABLE IF NOT EXISTS api.dentists (
    id UUID PRIMARY KEY,
    full_name TEXT NOT NULL,
    specialty TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create api.patients table
CREATE TABLE IF NOT EXISTS api.patients (
    id UUID PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    date_of_birth DATE,
    medical_history_summary TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create api.pending_registrations table
CREATE TABLE IF NOT EXISTS api.pending_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_data TEXT NOT NULL,
    submitted_at TIMESTAMP DEFAULT NOW() NOT NULL,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending' NOT NULL
);

-- ==========================================
-- ROW LEVEL SECURITY POLICIES (SAFE VERSION)
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE api.assistants ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.dentists ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.pending_registrations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (safe)
DROP POLICY IF EXISTS assistant_read_own ON api.assistants;
DROP POLICY IF EXISTS dentist_read_own ON api.dentists;
DROP POLICY IF EXISTS patient_read_own ON api.patients;
DROP POLICY IF EXISTS assistant_service_read ON api.assistants;
DROP POLICY IF EXISTS dentist_service_read ON api.dentists;
DROP POLICY IF EXISTS patient_service_read ON api.patients;
DROP POLICY IF EXISTS pending_reg_insert ON api.pending_registrations;
DROP POLICY IF EXISTS pending_reg_service_read ON api.pending_registrations;

-- Create policies
CREATE POLICY assistant_read_own ON api.assistants
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY dentist_read_own ON api.dentists
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY patient_read_own ON api.patients
    FOR SELECT USING (auth.uid() = id);

-- Allow service role to read all records (for server-side auth checks)
CREATE POLICY assistant_service_read ON api.assistants
    FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY dentist_service_read ON api.dentists
    FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY patient_service_read ON api.patients
    FOR SELECT USING (auth.role() = 'service_role');

-- Allow anyone to insert pending registrations
CREATE POLICY pending_reg_insert ON api.pending_registrations
    FOR INSERT WITH CHECK (true);

-- Allow service role to read all pending registrations
CREATE POLICY pending_reg_service_read ON api.pending_registrations
    FOR SELECT USING (auth.role() = 'service_role');

-- ==========================================
-- ADD TEST USER
-- ==========================================

-- Insert test assistant (safe - won't fail if exists)
INSERT INTO api.assistants (id, full_name)
SELECT 'c2d0d66d-0a86-406e-b6cf-0221a10a07e1', 'Test Assistant'
WHERE NOT EXISTS (
    SELECT 1 FROM api.assistants
    WHERE id = 'c2d0d66d-0a86-406e-b6cf-0221a10a07e1'
);

-- ==========================================
-- VERIFICATION
-- ==========================================

-- Check tables were created
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'api'
ORDER BY table_name;

-- Check test user was inserted
SELECT id, full_name FROM api.assistants WHERE id = 'c2d0d66d-0a86-406e-b6cf-0221a10a07e1';