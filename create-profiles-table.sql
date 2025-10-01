-- Create the main profiles table for ENDOFLOW authentication
-- This is the central table that connects auth.users to role-based data

-- First, drop the existing profiles table if it has wrong structure
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Create profiles table in public schema with correct structure
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('patient', 'assistant', 'dentist')) NOT NULL,
    status TEXT CHECK (status IN ('active', 'pending', 'inactive')) NOT NULL DEFAULT 'pending',
    full_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles table
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Allow service role to manage all profiles (for admin operations)
CREATE POLICY "Service role can manage all profiles" ON public.profiles
    FOR ALL USING (auth.role() = 'service_role');

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles(role);
CREATE INDEX IF NOT EXISTS profiles_status_idx ON public.profiles(status);
CREATE INDEX IF NOT EXISTS profiles_created_at_idx ON public.profiles(created_at);

-- Insert test users based on existing data
INSERT INTO public.profiles (id, role, status, full_name) VALUES
    ('75f070da-1019-4412-8af3-6e66086b9818', 'assistant', 'active', 'Test Assistant')
ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    full_name = EXCLUDED.full_name;

-- Function to automatically create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, status, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient')::TEXT,
    'pending',
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)::TEXT
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Verify the setup
SELECT 'Profiles table created successfully' AS status;
SELECT * FROM public.profiles LIMIT 5;