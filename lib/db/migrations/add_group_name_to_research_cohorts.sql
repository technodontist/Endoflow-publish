-- Migration: Add group_name column to research_cohorts table
-- This enables multi-group support for comparative studies and RCTs

-- Add group_name column with default value "Control"
ALTER TABLE api.research_cohorts
ADD COLUMN IF NOT EXISTS group_name TEXT NOT NULL DEFAULT 'Control';

-- Add comment to explain the column
COMMENT ON COLUMN api.research_cohorts.group_name IS 'Group assignment for comparative studies (e.g., Control, Treatment A, Treatment B)';

-- Create index for faster group-based queries
CREATE INDEX IF NOT EXISTS idx_research_cohorts_group_name
ON api.research_cohorts(project_id, group_name);

-- Verify the migration
SELECT
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'api'
AND table_name = 'research_cohorts'
AND column_name = 'group_name';
