-- Helper function to check if user is member of a workspace (Bypasses RLS)
CREATE OR REPLACE FUNCTION is_workspace_member_safe(_workspace_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
LANGUAGE sql
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members 
    WHERE workspace_id = _workspace_id 
    AND user_id = auth.uid()
  );
$$;

-- Helper function to check if user is owner of a workspace (Bypasses RLS)
CREATE OR REPLACE FUNCTION is_workspace_owner_safe(_workspace_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
LANGUAGE sql
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspaces 
    WHERE id = _workspace_id 
    AND owner_id = auth.uid()
  );
$$;

-- Fix Workspaces policies to use safe functions
DROP POLICY IF EXISTS "workspaces_select_member" ON workspaces;

CREATE POLICY "workspaces_select_member" ON workspaces
FOR SELECT
USING (
  owner_id = auth.uid()
  OR
  is_workspace_member_safe(id)
);

-- Fix Projects policies using SAFE functions (re-apply to be sure)
DROP POLICY IF EXISTS "projects_select_project_member_or_workspace_owner" ON projects;

DROP POLICY IF EXISTS "projects_select_safe" ON projects;

CREATE POLICY "projects_select_safe" ON projects
FOR SELECT
USING (
  -- Creator
  user_id = auth.uid()
  OR
  -- Direct Member (using the safe function from previous step? No, let's use direct table access in a function if needed, but direct query is recursive. Use function.)
  is_project_member_safe_definer(id)
  OR
  -- Workspace Owner
  is_workspace_owner_safe(workspace_id)
);

-- Need a safe project member checker too
CREATE OR REPLACE FUNCTION is_project_member_safe_definer(_project_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
LANGUAGE sql
AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members 
    WHERE project_id = _project_id 
    AND member_id = auth.uid()
  );
$$;
