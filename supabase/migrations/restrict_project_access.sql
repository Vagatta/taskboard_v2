-- Drop the overly permissive policy
DROP POLICY IF EXISTS "projects_select_member" ON projects;

-- Drop the new policy if it exists (for idempotency)
DROP POLICY IF EXISTS "projects_select_project_member_or_workspace_owner" ON projects;

-- Create stricter policy: Only project members OR workspace owners can see the project
CREATE POLICY "projects_select_project_member_or_workspace_owner" ON projects
FOR SELECT
USING (
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
