-- Fix research_cohorts table to match schema definition
-- This adds the missing group_name and anonymous_id columns

-- Check if columns exist and add them if missing
DO $$
BEGIN
    -- Add group_name column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'api'
        AND table_name = 'research_cohorts'
        AND column_name = 'group_name'
    ) THEN
        ALTER TABLE api.research_cohorts
        ADD COLUMN group_name TEXT NOT NULL DEFAULT 'Control';

        RAISE NOTICE 'Added group_name column';
    ELSE
        RAISE NOTICE 'group_name column already exists';
    END IF;

    -- Add anonymous_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'api'
        AND table_name = 'research_cohorts'
        AND column_name = 'anonymous_id'
    ) THEN
        ALTER TABLE api.research_cohorts
        ADD COLUMN anonymous_id TEXT NOT NULL DEFAULT 'P000';

        -- Generate unique anonymous IDs for existing rows
        WITH numbered_rows AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY inclusion_date) as rn
            FROM api.research_cohorts
        )
        UPDATE api.research_cohorts rc
        SET anonymous_id = 'P' || LPAD(nr.rn::TEXT, 3, '0')
        FROM numbered_rows nr
        WHERE rc.id = nr.id;

        RAISE NOTICE 'Added anonymous_id column and generated IDs';
    ELSE
        RAISE NOTICE 'anonymous_id column already exists';
    END IF;

    -- Add baseline_data_collected column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'api'
        AND table_name = 'research_cohorts'
        AND column_name = 'baseline_data_collected'
    ) THEN
        ALTER TABLE api.research_cohorts
        ADD COLUMN baseline_data_collected BOOLEAN NOT NULL DEFAULT FALSE;

        RAISE NOTICE 'Added baseline_data_collected column';
    ELSE
        RAISE NOTICE 'baseline_data_collected column already exists';
    END IF;

    -- Add follow_up_data_collected column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'api'
        AND table_name = 'research_cohorts'
        AND column_name = 'follow_up_data_collected'
    ) THEN
        ALTER TABLE api.research_cohorts
        ADD COLUMN follow_up_data_collected BOOLEAN NOT NULL DEFAULT FALSE;

        RAISE NOTICE 'Added follow_up_data_collected column';
    ELSE
        RAISE NOTICE 'follow_up_data_collected column already exists';
    END IF;

    -- Add research_data column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'api'
        AND table_name = 'research_cohorts'
        AND column_name = 'research_data'
    ) THEN
        ALTER TABLE api.research_cohorts
        ADD COLUMN research_data TEXT;

        RAISE NOTICE 'Added research_data column';
    ELSE
        RAISE NOTICE 'research_data column already exists';
    END IF;

    -- Add notes column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'api'
        AND table_name = 'research_cohorts'
        AND column_name = 'notes'
    ) THEN
        ALTER TABLE api.research_cohorts
        ADD COLUMN notes TEXT;

        RAISE NOTICE 'Added notes column';
    ELSE
        RAISE NOTICE 'notes column already exists';
    END IF;
END $$;

-- Verify the table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'api'
AND table_name = 'research_cohorts'
ORDER BY ordinal_position;
