-- Allow project members with 'owner' role to delete other project members
-- Previously only the project creator (projects.user_id) and workspace owner could delete.
-- This adds support for users assigned the 'owner' role in project_members.

CREATE OR REPLACE FUNCTION is_project_owner_member(_project_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
LANGUAGE sql
AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = _project_id
    AND member_id = auth.uid()
    AND role = 'owner'
  );
$$;

DROP POLICY IF EXISTS "project_members_delete" ON project_members;

CREATE POLICY "project_members_delete" ON project_members
FOR DELETE
USING (
  -- Member can leave (remove themselves)
  member_id = auth.uid()
  OR
  -- Project creator can remove members
  is_project_creator(project_id)
  OR
  -- Workspace owner can remove members
  is_workspace_owner_for_project(project_id)
  OR
  -- Project member with 'owner' role can remove other members
  is_project_owner_member(project_id)
);
