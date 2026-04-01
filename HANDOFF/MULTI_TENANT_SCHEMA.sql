-- ============================================
-- ENDOFLOW: Multi-Tenant Isolation Schema
-- Run this in Supabase SQL Editor
-- Created: 2026-03-26
-- ============================================

-- Step 1: Create clinics table
CREATE TABLE IF NOT EXISTS public.clinics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE, -- URL-friendly identifier
  address text,
  phone text,
  email text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  settings jsonb DEFAULT '{}'::jsonb, -- Clinic-specific settings
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

-- Step 2: Add clinic_id to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id);

-- Step 3: Create a default clinic for all existing users
INSERT INTO public.clinics (id, name, slug, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'EndoFlow Dental Clinic', 'endoflow-default', 'active')
ON CONFLICT (id) DO NOTHING;

-- Step 4: Assign ALL existing profiles to the default clinic
UPDATE public.profiles
SET clinic_id = '00000000-0000-0000-0000-000000000001'
WHERE clinic_id IS NULL;

-- Step 5: Grant permissions on clinics table
GRANT SELECT, INSERT, UPDATE ON public.clinics TO authenticated;
GRANT SELECT ON public.clinics TO anon;
GRANT ALL ON public.clinics TO service_role;

-- Step 6: Reload schema cache
NOTIFY pgrst, 'reload schema';

-- Step 7: Verify
SELECT p.full_name, p.role, p.status, p.clinic_id, c.name as clinic_name
FROM public.profiles p
LEFT JOIN public.clinics c ON p.clinic_id = c.id
WHERE p.role IN ('dentist', 'assistant')
ORDER BY p.role, p.full_name;
