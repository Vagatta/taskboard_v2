-- Function to get workspace members with emails securely
-- Bypasses RLS on profiles to allow seeing emails of teammates
CREATE OR REPLACE FUNCTION get_workspace_members_and_profiles(p_workspace_ids uuid[])
RETURNS TABLE (
  workspace_id uuid,
  user_id uuid,
  role text,
  email text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify the user has access to these workspaces is implicit?
  -- ideally we filter to only return members for workspaces where the current user IS ALSO a member.
  RETURN QUERY
  SELECT
    wm.workspace_id,
    wm.user_id,
    wm.role,
    p.email
  FROM workspace_members wm
  LEFT JOIN profiles p ON wm.user_id = p.id
  WHERE wm.workspace_id = ANY(p_workspace_ids)
  AND EXISTS (
    SELECT 1 FROM workspace_members my_wm
    WHERE my_wm.workspace_id = wm.workspace_id
    AND my_wm.user_id = auth.uid()
  );
END;
$$;
