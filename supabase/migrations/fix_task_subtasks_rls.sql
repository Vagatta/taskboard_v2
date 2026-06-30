-- Fix RLS policies for task_subtasks table
-- The table references tasks(task_id) and needs project-based access control

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS task_subtasks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "task_subtasks_select" ON task_subtasks;
DROP POLICY IF EXISTS "task_subtasks_insert" ON task_subtasks;
DROP POLICY IF EXISTS "task_subtasks_update" ON task_subtasks;
DROP POLICY IF EXISTS "task_subtasks_delete" ON task_subtasks;
DROP POLICY IF EXISTS "task_subtasks_modify" ON task_subtasks;
DROP POLICY IF EXISTS "task_subtasks_select_public" ON task_subtasks;
DROP POLICY IF EXISTS "task_subtasks_modify_public" ON task_subtasks;

-- Helper: check if current user has access to the project of the parent task
CREATE OR REPLACE FUNCTION public.can_access_task_project(task_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.id = task_uuid
    AND (
      -- Direct project member
      EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.project_id = t.project_id
        AND pm.member_id = auth.uid()
      )
      -- Project creator
      OR EXISTS (
        SELECT 1 FROM projects p
        WHERE p.id = t.project_id
        AND p.user_id = auth.uid()
      )
      -- Workspace owner
      OR EXISTS (
        SELECT 1 FROM projects p
        JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
        WHERE p.id = t.project_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'owner'
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- SELECT
CREATE POLICY "task_subtasks_select" ON task_subtasks
FOR SELECT
USING (public.can_access_task_project(task_id));

-- INSERT
CREATE POLICY "task_subtasks_insert" ON task_subtasks
FOR INSERT
WITH CHECK (public.can_access_task_project(task_id));

-- UPDATE
CREATE POLICY "task_subtasks_update" ON task_subtasks
FOR UPDATE
USING (public.can_access_task_project(task_id))
WITH CHECK (public.can_access_task_project(task_id));

-- DELETE
CREATE POLICY "task_subtasks_delete" ON task_subtasks
FOR DELETE
USING (public.can_access_task_project(task_id));
