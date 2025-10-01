-- Create assistants table
CREATE TABLE IF NOT EXISTS public.assistants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create dentists table
CREATE TABLE IF NOT EXISTS public.dentists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  specialty TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create patients table
CREATE TABLE IF NOT EXISTS public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE,
  medical_history_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create pending_registrations table
CREATE TABLE IF NOT EXISTS public.pending_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_data TEXT NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- Enable Row Level Security
ALTER TABLE public.assistants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dentists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_registrations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (basic read/write access for authenticated users)
CREATE POLICY "Allow authenticated users to read assistants" ON public.assistants
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to read dentists" ON public.dentists
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to read patients" ON public.patients
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to read pending registrations" ON public.pending_registrations
  FOR SELECT TO authenticated USING (true);

-- Allow inserting for authenticated users
CREATE POLICY "Allow authenticated users to insert assistants" ON public.assistants
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to insert dentists" ON public.dentists
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to insert patients" ON public.patients
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to insert pending registrations" ON public.pending_registrations
  FOR INSERT TO authenticated WITH CHECK (true);