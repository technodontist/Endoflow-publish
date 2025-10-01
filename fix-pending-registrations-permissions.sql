-- Fix permissions for pending_registrations table
-- Allow assistants to read pending registrations for their workflow

-- Add policy to allow assistants to read all pending registrations
-- (They need this to manage user registration approvals)
CREATE POLICY pending_reg_assistant_read ON api.pending_registrations
    FOR SELECT USING (
        auth.role() = 'service_role' OR
        EXISTS (
            SELECT 1 FROM api.assistants
            WHERE id = auth.uid()
        )
    );

-- Drop the old service-only policy
DROP POLICY pending_reg_service_read ON api.pending_registrations;