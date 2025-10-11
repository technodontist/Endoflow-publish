-- FIX VOICE_SESSIONS TABLE PERMISSIONS
-- Run this in Supabase SQL Editor to fix permission issues

-- Grant necessary permissions to authenticated users and service role
GRANT ALL ON api.voice_sessions TO authenticated;
GRANT ALL ON api.voice_sessions TO service_role;

-- Grant usage on the api schema (if not already granted)
GRANT USAGE ON SCHEMA api TO authenticated;
GRANT USAGE ON SCHEMA api TO service_role;

-- Grant permissions on the sequence (for UUID generation)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA api TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA api TO service_role;

-- Ensure RLS is enabled
ALTER TABLE api.voice_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Dentists can manage voice sessions" ON api.voice_sessions;

-- Re-create the policy for dentists to manage voice sessions
CREATE POLICY "Dentists can manage voice sessions" ON api.voice_sessions
FOR ALL TO authenticated
USING (
    dentist_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role = 'dentist'
        AND status = 'active'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role = 'dentist'
        AND status = 'active'
    )
);

-- Verify the permissions
SELECT 
    'voice_sessions permissions fixed!' AS status,
    has_table_privilege('authenticated', 'api.voice_sessions', 'SELECT') AS can_select,
    has_table_privilege('authenticated', 'api.voice_sessions', 'INSERT') AS can_insert,
    has_table_privilege('authenticated', 'api.voice_sessions', 'UPDATE') AS can_update,
    has_table_privilege('authenticated', 'api.voice_sessions', 'DELETE') AS can_delete;
