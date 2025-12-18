-- Drop the previous policy to ensure clean slate
DROP POLICY IF EXISTS "projects_select_member" ON projects;
DROP POLICY IF EXISTS "projects_select_project_member_or_workspace_owner" ON projects;

-- Create robust policy:
-- 1. Direct project members
-- 2. Workspace owners
-- 3. Project creators (owner_id) - CRITICAL for creation flow
CREATE POLICY "projects_select_project_member_or_workspace_owner" ON projects
FOR SELECT
USING (
  (
    -- User is the creator/owner of the project record
    auth.uid() = projects.user_id
  )
  OR
  (
    -- User is a direct member of the project
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = projects.id 
      AND pm.member_id = auth.uid()
    )
  )
  OR
  (
    -- User is an owner of the workspace
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = projects.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role = 'owner'
    )
  )
);
