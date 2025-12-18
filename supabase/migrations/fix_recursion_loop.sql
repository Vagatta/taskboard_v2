-- Helper function to check if user is project creator (Bypasses RLS)
CREATE OR REPLACE FUNCTION is_project_creator(_project_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
LANGUAGE sql
AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects 
    WHERE id = _project_id 
    AND user_id = auth.uid()
  );
$$;

-- Helper function to check if user is workspace owner for a project (Bypasses RLS)
CREATE OR REPLACE FUNCTION is_workspace_owner_for_project(_project_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
LANGUAGE sql
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspaces w
    JOIN projects p ON p.workspace_id = w.id
    WHERE p.id = _project_id
    AND w.owner_id = auth.uid()
  );
$$;

-- Refactor project_members policies to use these safe functions
DROP POLICY IF EXISTS "Allow select member projects" ON project_members;
DROP POLICY IF EXISTS "Allow update member projects" ON project_members;
DROP POLICY IF EXISTS "Allow delete member projects" ON project_members;
DROP POLICY IF EXISTS "Allow insert member projects" ON project_members;

CREATE POLICY "project_members_select" ON project_members
FOR SELECT
USING (
  -- Member sees themselves
  member_id = auth.uid()
  OR
  -- Project creator sees members
  is_project_creator(project_id)
  OR
  -- Workspace owner sees members
  is_workspace_owner_for_project(project_id)
);

CREATE POLICY "project_members_insert" ON project_members
FOR INSERT
WITH CHECK (
  -- Project creator can add members
  is_project_creator(project_id)
  OR
  -- Workspace owner can add members
  is_workspace_owner_for_project(project_id)
  OR
  -- Users can add themselves (joining)
  member_id = auth.uid()
);

CREATE POLICY "project_members_update" ON project_members
FOR UPDATE
USING (
  is_project_creator(project_id)
  OR
  is_workspace_owner_for_project(project_id)
);

CREATE POLICY "project_members_delete" ON project_members
FOR DELETE
USING (
  -- Member can leave
  member_id = auth.uid()
  OR
  -- Project creator can remove members
  is_project_creator(project_id)
  OR
  -- Workspace owner can remove members
  is_workspace_owner_for_project(project_id)
);
