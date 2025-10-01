-- Add missing specialty column to dentists table
ALTER TABLE public.dentists ADD COLUMN IF NOT EXISTS specialty TEXT;