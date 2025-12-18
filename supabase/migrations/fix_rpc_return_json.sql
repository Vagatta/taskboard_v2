-- Reemplazar la función con una versión que devuelve JSON para evitar problemas de tipos
DROP FUNCTION IF EXISTS get_my_pending_invitations();

CREATE OR REPLACE FUNCTION get_my_pending_invitations()
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(
    json_build_object(
      'id', wi.id,
      'workspace_id', wi.workspace_id,
      'email', wi.email,
      'role', wi.role,
      'token', wi.token,
      'expires_at', wi.expires_at,
      'created_at', wi.created_at,
      'workspace_name', w.name
    )
  ) INTO result
  FROM workspace_invitations wi
  JOIN workspaces w ON wi.workspace_id = w.id
  WHERE wi.email = (SELECT email FROM profiles WHERE id = auth.uid())
    AND wi.accepted_at IS NULL
    AND wi.expires_at > NOW();

  RETURN COALESCE(result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_pending_invitations() TO authenticated;
