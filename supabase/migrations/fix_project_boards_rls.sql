-- Fix RLS policies for project_boards table
-- The table references projects(project_id) and needs project-based access control

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS project_boards ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "project_boards_select" ON project_boards;
DROP POLICY IF EXISTS "project_boards_insert" ON project_boards;
DROP POLICY IF EXISTS "project_boards_update" ON project_boards;
DROP POLICY IF EXISTS "project_boards_delete" ON project_boards;

-- Helper: check if current user has access to a project
CREATE OR REPLACE FUNCTION public.can_access_project(project_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_uuid
    AND (
      -- Direct project member
      EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.project_id = p.id
        AND pm.member_id = auth.uid()
      )
      -- Project creator
      OR p.user_id = auth.uid()
      -- Workspace owner
      OR EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = p.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'owner'
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- SELECT
CREATE POLICY "project_boards_select" ON project_boards
FOR SELECT
USING (public.can_access_project(project_id));

-- INSERT
CREATE POLICY "project_boards_insert" ON project_boards
FOR INSERT
WITH CHECK (public.can_access_project(project_id));

-- UPDATE
CREATE POLICY "project_boards_update" ON project_boards
FOR UPDATE
USING (public.can_access_project(project_id))
WITH CHECK (public.can_access_project(project_id));

-- DELETE
CREATE POLICY "project_boards_delete" ON project_boards
FOR DELETE
USING (public.can_access_project(project_id));
