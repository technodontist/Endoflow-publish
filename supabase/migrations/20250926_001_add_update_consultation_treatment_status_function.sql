-- Migration: Add update_consultation_treatment_status function
-- Created: 2025-09-26
-- This function updates the treatment status in the consultation's clinical_data JSONB field

-- Drop the function if it exists
DROP FUNCTION IF EXISTS public.update_consultation_treatment_status(UUID, UUID, TEXT);

-- Create the function
CREATE OR REPLACE FUNCTION public.update_consultation_treatment_status(
    p_consultation_id UUID,
    p_treatment_id UUID,
    p_new_status TEXT
)
RETURNS void AS $$
BEGIN
    -- Update the clinical_data JSONB field in the consultations table
    -- Find the treatment in the treatments array and update its status
    UPDATE api.consultations
    SET clinical_data = jsonb_set(
        clinical_data,
        '{treatments}',
        COALESCE(
            (
                SELECT jsonb_agg(
                    CASE
                        WHEN (elem->>'id')::uuid = p_treatment_id
                        THEN elem || jsonb_build_object('status', p_new_status)
                        ELSE elem
                    END
                )
                FROM jsonb_array_elements(
                    COALESCE(clinical_data->'treatments', '[]'::jsonb)
                ) AS elem
            ),
            '[]'::jsonb
        )
    ),
    updated_at = NOW()
    WHERE id = p_consultation_id;

    -- Also update the treatment table if it exists
    UPDATE api.treatments
    SET 
        planned_status = p_new_status,
        status = LOWER(p_new_status),
        completed_at = CASE 
            WHEN LOWER(p_new_status) = 'completed' THEN NOW() 
            ELSE completed_at 
        END,
        updated_at = NOW()
    WHERE id = p_treatment_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_consultation_treatment_status(UUID, UUID, TEXT) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.update_consultation_treatment_status(UUID, UUID, TEXT) IS 
'Updates the treatment status in both the consultation clinical_data JSONB field and the treatments table';