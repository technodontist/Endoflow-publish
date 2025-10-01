-- Insert the existing user into the assistants table
-- Using the user ID from the error logs: c2d0d66d-0a86-406e-b6cf-0221a10a07e1
INSERT INTO public.assistants (id, full_name, created_at)
VALUES (
  'c2d0d66d-0a86-406e-b6cf-0221a10a07e1',
  'Test Assistant',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Add some sample data for testing
INSERT INTO public.dentists (id, full_name, specialty, created_at)
VALUES (
  gen_random_uuid(),
  'Dr. John Smith',
  'General Dentistry',
  NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.patients (id, uhid, first_name, last_name, date_of_birth, medical_history_summary, created_at)
VALUES (
  gen_random_uuid(),
  'UHID-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-001',
  'Jane',
  'Doe',
  '1990-05-15',
  'No known allergies. Regular checkups.',
  NOW()
) ON CONFLICT (id) DO NOTHING;