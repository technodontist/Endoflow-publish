-- FIX: Registration clinic_id assignment
-- Run this in Supabase SQL Editor
-- Date: 2026-03-26

-- 1. Update the handle_new_user() trigger to assign default clinic_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, status, full_name, clinic_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient')::TEXT,
    'pending',
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)::TEXT,
    '00000000-0000-0000-0000-000000000001'::UUID  -- Default clinic
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fix any existing profiles with NULL clinic_id (assign to default clinic)
UPDATE public.profiles
SET clinic_id = '00000000-0000-0000-0000-000000000001'
WHERE clinic_id IS NULL;

-- 3. Verify: count profiles without clinic_id (should be 0)
SELECT COUNT(*) AS profiles_without_clinic FROM public.profiles WHERE clinic_id IS NULL;

-- 4. Verify trigger is still attached
SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE tgname = 'on_auth_user_created';
