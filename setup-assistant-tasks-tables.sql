-- Create assistant_tasks table
CREATE TABLE IF NOT EXISTS api.assistant_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Task details
  title TEXT NOT NULL,
  description TEXT NOT NULL,

  -- Patient association (optional)
  patient_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  patient_name TEXT,

  -- Priority and scheduling
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
  due_date TIMESTAMPTZ,
  estimated_duration INTEGER,

  -- Status workflow
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed', 'cancelled', 'on_hold')),

  -- Progress tracking
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Additional metadata
  category TEXT,
  tags TEXT,
  notes TEXT,

  -- Status tracking
  is_urgent BOOLEAN NOT NULL DEFAULT FALSE,
  requires_follow_up BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create task_comments table
CREATE TABLE IF NOT EXISTS api.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES api.assistant_tasks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL CHECK (author_type IN ('dentist', 'assistant')),

  -- Comment content
  comment TEXT NOT NULL,
  comment_type TEXT NOT NULL DEFAULT 'update' CHECK (comment_type IN ('update', 'question', 'instruction', 'completion')),

  -- Status change tracking
  previous_status TEXT,
  new_status TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create task_activity_log table
CREATE TABLE IF NOT EXISTS api.task_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES api.assistant_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type TEXT NOT NULL CHECK (user_type IN ('dentist', 'assistant')),

  -- Activity details
  action TEXT NOT NULL,
  previous_value TEXT,
  new_value TEXT,

  -- Context
  description TEXT NOT NULL,
  metadata TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for assistant_tasks
CREATE INDEX IF NOT EXISTS idx_assistant_tasks_created_by ON api.assistant_tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_assistant_tasks_assigned_to ON api.assistant_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_assistant_tasks_status ON api.assistant_tasks(status);
CREATE INDEX IF NOT EXISTS idx_assistant_tasks_priority ON api.assistant_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_assistant_tasks_due_date ON api.assistant_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_assistant_tasks_patient_id ON api.assistant_tasks(patient_id);
CREATE INDEX IF NOT EXISTS idx_assistant_tasks_is_urgent ON api.assistant_tasks(is_urgent);
CREATE INDEX IF NOT EXISTS idx_assistant_tasks_created_at ON api.assistant_tasks(created_at);

-- Create indexes for task_comments
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON api.task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_author_id ON api.task_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_created_at ON api.task_comments(created_at);

-- Create indexes for task_activity_log
CREATE INDEX IF NOT EXISTS idx_task_activity_log_task_id ON api.task_activity_log(task_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_log_user_id ON api.task_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_log_created_at ON api.task_activity_log(created_at);

-- Enable RLS on all tables
ALTER TABLE api.assistant_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.task_activity_log ENABLE ROW LEVEL SECURITY;

-- Policies for assistant_tasks
-- Dentists can create, view, and manage all tasks
CREATE POLICY "Dentists can manage all tasks" ON api.assistant_tasks
  FOR ALL TO authenticated
  USING (
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

-- Assistants can view tasks assigned to them or unassigned tasks
CREATE POLICY "Assistants can view assigned or unassigned tasks" ON api.assistant_tasks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'assistant'
      AND status = 'active'
    )
    AND (assigned_to = auth.uid() OR assigned_to IS NULL)
  );

-- Assistants can update status of tasks assigned to them
CREATE POLICY "Assistants can update assigned tasks" ON api.assistant_tasks
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'assistant'
      AND status = 'active'
    )
    AND (assigned_to = auth.uid() OR assigned_to IS NULL)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'assistant'
      AND status = 'active'
    )
    AND (assigned_to = auth.uid() OR assigned_to IS NULL)
  );

-- Policies for task_comments
-- Users can view comments for tasks they have access to
CREATE POLICY "Users can view task comments" ON api.task_comments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM api.assistant_tasks t
      WHERE t.id = task_id
      AND (
        -- Dentists can see all task comments
        (EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
          AND role = 'dentist'
          AND status = 'active'
        ))
        OR
        -- Assistants can see comments for their assigned tasks
        (EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
          AND role = 'assistant'
          AND status = 'active'
        )
        AND (t.assigned_to = auth.uid() OR t.assigned_to IS NULL))
      )
    )
  );

-- Users can add comments to tasks they have access to
CREATE POLICY "Users can add task comments" ON api.task_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM api.assistant_tasks t
      WHERE t.id = task_id
      AND (
        -- Dentists can comment on all tasks
        (EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
          AND role = 'dentist'
          AND status = 'active'
        ))
        OR
        -- Assistants can comment on their assigned tasks
        (EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
          AND role = 'assistant'
          AND status = 'active'
        )
        AND (t.assigned_to = auth.uid() OR t.assigned_to IS NULL))
      )
    )
  );

-- Policies for task_activity_log
-- Users can view activity logs for tasks they have access to
CREATE POLICY "Users can view task activity logs" ON api.task_activity_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM api.assistant_tasks t
      WHERE t.id = task_id
      AND (
        -- Dentists can see all activity logs
        (EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
          AND role = 'dentist'
          AND status = 'active'
        ))
        OR
        -- Assistants can see logs for their assigned tasks
        (EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
          AND role = 'assistant'
          AND status = 'active'
        )
        AND (t.assigned_to = auth.uid() OR t.assigned_to IS NULL))
      )
    )
  );

-- System can insert activity logs
CREATE POLICY "System can insert activity logs" ON api.task_activity_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Create or replace function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for assistant_tasks
DROP TRIGGER IF EXISTS update_assistant_tasks_updated_at ON api.assistant_tasks;
CREATE TRIGGER update_assistant_tasks_updated_at
  BEFORE UPDATE ON api.assistant_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();