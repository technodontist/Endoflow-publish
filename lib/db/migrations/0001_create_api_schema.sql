-- Create the API schema
CREATE SCHEMA IF NOT EXISTS api;

-- Create api.assistants table
CREATE TABLE api.assistants (
    id UUID PRIMARY KEY,
    full_name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create api.dentists table
CREATE TABLE api.dentists (
    id UUID PRIMARY KEY,
    full_name TEXT NOT NULL,
    specialty TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create api.patients table
CREATE TABLE api.patients (
    id UUID PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    date_of_birth DATE,
    medical_history_summary TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create api.pending_registrations table
CREATE TABLE api.pending_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_data TEXT NOT NULL,
    submitted_at TIMESTAMP DEFAULT NOW() NOT NULL,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending' NOT NULL
);