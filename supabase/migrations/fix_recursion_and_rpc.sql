-- Eliminar la política que causa recursión infinita
DROP POLICY IF EXISTS "Users can view workspaces they are invited to" ON workspaces;

-- Función segura para obtener mis invitaciones con el nombre del workspace
DROP FUNCTION IF EXISTS get_my_pending_invitations();
CREATE OR REPLACE FUNCTION get_my_pending_invitations()
RETURNS TABLE (
  id UUID,
  workspace_id UUID,
  email TEXT,
  role TEXT,
  token TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  workspace_name TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  current_email TEXT;
BEGIN
  -- Get email from JWT (fastest and most reliable for auth context)
  current_email := auth.jwt() ->> 'email';
  
  -- Fallback to profile if JWT is somehow missing email (unlikely but safe)
  IF current_email IS NULL THEN
    SELECT email INTO current_email FROM profiles WHERE id = auth.uid();
  END IF;

  RETURN QUERY
  SELECT 
    wi.id,
    wi.workspace_id,
    wi.email,
    wi.role,
    wi.token,
    wi.expires_at,
    wi.created_at,
    w.name AS workspace_name
  FROM workspace_invitations wi
  JOIN workspaces w ON wi.workspace_id = w.id
  WHERE LOWER(wi.email) = LOWER(current_email)
    AND wi.accepted_at IS NULL
    AND wi.expires_at > NOW()
  ORDER BY wi.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_pending_invitations() TO authenticated;
