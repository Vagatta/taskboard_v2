-- =====================================================
-- FUNCIÓN RPC: Obtener mis invitaciones de proyecto pendientes
-- Descripción: Retorna las invitaciones de proyecto para el usuario actual
-- =====================================================

CREATE OR REPLACE FUNCTION get_my_pending_project_invitations()
RETURNS TABLE (
  id UUID,
  project_id UUID,
  email TEXT,
  role TEXT,
  token TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  project_name TEXT,
  workspace_name TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  current_email TEXT;
BEGIN
  -- Get email from JWT
  current_email := auth.jwt() ->> 'email';
  
  -- Fallback to profile
  IF current_email IS NULL THEN
    SELECT email INTO current_email FROM profiles WHERE id = auth.uid();
  END IF;

  RETURN QUERY
  SELECT 
    pi.id,
    pi.project_id,
    pi.email,
    pi.role,
    pi.token,
    pi.expires_at,
    pi.created_at,
    p.name AS project_name,
    w.name AS workspace_name
  FROM project_invitations pi
  JOIN projects p ON pi.project_id = p.id
  JOIN workspaces w ON p.workspace_id = w.id
  WHERE LOWER(pi.email) = LOWER(current_email)
    AND pi.accepted_at IS NULL
    AND pi.expires_at > NOW()
  ORDER BY pi.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_pending_project_invitations() TO authenticated;
