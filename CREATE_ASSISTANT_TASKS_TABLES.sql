-- Create assistant tasks tables in API schema
-- Run this SQL in Supabase SQL Editor

-- Create assistant_tasks table in api schema
CREATE TABLE IF NOT EXISTS api.assistant_tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by uuid NOT NULL,
    assigned_to uuid,
    title text NOT NULL,
    description text NOT NULL,
    status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed', 'cancelled', 'on_hold')),
    priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
    patient_id uuid,
    patient_name text,
    due_date timestamptz,
    category text,
    is_urgent boolean NOT NULL DEFAULT false,
    started_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create task_comments table in api schema
CREATE TABLE IF NOT EXISTS api.task_comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id uuid NOT NULL REFERENCES api.assistant_tasks(id) ON DELETE CASCADE,
    author_id uuid NOT NULL,
    author_type text NOT NULL CHECK (author_type IN ('dentist', 'assistant')),
    comment text NOT NULL,
    comment_type text NOT NULL DEFAULT 'update',
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Create task_activity_log table in api schema
CREATE TABLE IF NOT EXISTS api.task_activity_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id uuid NOT NULL REFERENCES api.assistant_tasks(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    user_type text NOT NULL CHECK (user_type IN ('dentist', 'assistant')),
    action text NOT NULL,
    previous_value text,
    new_value text,
    description text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_assistant_tasks_assigned_to ON api.assistant_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_assistant_tasks_created_by ON api.assistant_tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_assistant_tasks_status ON api.assistant_tasks(status);
CREATE INDEX IF NOT EXISTS idx_assistant_tasks_priority ON api.assistant_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_assistant_tasks_patient_id ON api.assistant_tasks(patient_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON api.task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_log_task_id ON api.task_activity_log(task_id);

-- Enable Row Level Security
ALTER TABLE api.assistant_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.task_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for assistant_tasks
DROP POLICY IF EXISTS "Users can view tasks they created or are assigned to" ON api.assistant_tasks;
CREATE POLICY "Users can view tasks they created or are assigned to" ON api.assistant_tasks
    FOR SELECT TO authenticated
    USING (
        created_by = auth.uid() OR
        assigned_to = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('dentist', 'assistant')
            AND status = 'active'
        )
    );

DROP POLICY IF EXISTS "Dentists can create tasks" ON api.assistant_tasks;
CREATE POLICY "Dentists can create tasks" ON api.assistant_tasks
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'dentist'
            AND status = 'active'
        )
        AND created_by = auth.uid()
    );

DROP POLICY IF EXISTS "Users can update tasks they created or are assigned to" ON api.assistant_tasks;
CREATE POLICY "Users can update tasks they created or are assigned to" ON api.assistant_tasks
    FOR UPDATE TO authenticated
    USING (
        created_by = auth.uid() OR
        assigned_to = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'dentist'
            AND status = 'active'
        )
    );

-- RLS Policies for task_comments
DROP POLICY IF EXISTS "Users can view comments on accessible tasks" ON api.task_comments;
CREATE POLICY "Users can view comments on accessible tasks" ON api.task_comments
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM api.assistant_tasks t
            WHERE t.id = task_id
            AND (t.created_by = auth.uid() OR t.assigned_to = auth.uid() OR
                 EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('dentist', 'assistant') AND status = 'active'))
        )
    );

DROP POLICY IF EXISTS "Users can add comments to accessible tasks" ON api.task_comments;
CREATE POLICY "Users can add comments to accessible tasks" ON api.task_comments
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM api.assistant_tasks t
            WHERE t.id = task_id
            AND (t.created_by = auth.uid() OR t.assigned_to = auth.uid() OR
                 EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('dentist', 'assistant') AND status = 'active'))
        )
        AND author_id = auth.uid()
    );

-- RLS Policies for task_activity_log
DROP POLICY IF EXISTS "Users can view activity logs on accessible tasks" ON api.task_activity_log;
CREATE POLICY "Users can view activity logs on accessible tasks" ON api.task_activity_log
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM api.assistant_tasks t
            WHERE t.id = task_id
            AND (t.created_by = auth.uid() OR t.assigned_to = auth.uid() OR
                 EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('dentist', 'assistant') AND status = 'active'))
        )
    );

DROP POLICY IF EXISTS "Users can add activity logs for accessible tasks" ON api.task_activity_log;
CREATE POLICY "Users can add activity logs for accessible tasks" ON api.task_activity_log
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM api.assistant_tasks t
            WHERE t.id = task_id
            AND (t.created_by = auth.uid() OR t.assigned_to = auth.uid() OR
                 EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('dentist', 'assistant') AND status = 'active'))
        )
        AND user_id = auth.uid()
    );

-- Update function for updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for updating updated_at
DROP TRIGGER IF EXISTS update_assistant_tasks_updated_at ON api.assistant_tasks;
CREATE TRIGGER update_assistant_tasks_updated_at
    BEFORE UPDATE ON api.assistant_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Verify tables were created by selecting from them
SELECT 'assistant_tasks table created' as result, count(*) as existing_records FROM api.assistant_tasks;
SELECT 'task_comments table created' as result, count(*) as existing_records FROM api.task_comments;
SELECT 'task_activity_log table created' as result, count(*) as existing_records FROM api.task_activity_log;