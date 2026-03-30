-- =====================================================
-- FUNCIÓN SEGURA PARA OBTENER INVITACIÓN POR TOKEN
-- =====================================================

-- Esta función permite obtener los detalles de una invitación usando solo el token.
-- Es SECURITY DEFINER para saltarse las políticas RLS restrictivas,
-- pero solo retorna datos si el token coincide exactamante.

DROP FUNCTION IF EXISTS get_invitation_by_token(TEXT);

CREATE OR REPLACE FUNCTION get_invitation_by_token(token_input TEXT)
RETURNS TABLE (
    id UUID,
    invitation_type TEXT,
    email TEXT,
    role TEXT,
    workspace_name TEXT,
    project_name TEXT,
    inviter_email TEXT,
    expires_at TIMESTAMPTZ,
    workspace_id UUID,
    project_id UUID
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        wi.id,
        'workspace'::TEXT,
        wi.email,
        wi.role,
        w.name as workspace_name,
        NULL::TEXT as project_name,
        p.email as inviter_email,
        wi.expires_at,
        wi.workspace_id,
        NULL::UUID as project_id
    FROM workspace_invitations wi
    JOIN workspaces w ON w.id = wi.workspace_id
    LEFT JOIN profiles p ON p.id = wi.invited_by
    WHERE wi.token = token_input
    AND wi.accepted_at IS NULL
    AND wi.expires_at > NOW()

    UNION ALL

    SELECT
        pi.id,
        'project'::TEXT,
        pi.email,
        pi.role,
        w.name as workspace_name,
        pr.name as project_name,
        p.email as inviter_email,
        pi.expires_at,
        pr.workspace_id,
        pi.project_id
    FROM project_invitations pi
    JOIN projects pr ON pr.id = pi.project_id
    JOIN workspaces w ON w.id = pr.workspace_id
    LEFT JOIN profiles p ON p.id = pi.invited_by
    WHERE pi.token = token_input
    AND pi.accepted_at IS NULL
    AND pi.expires_at > NOW();
END;
$$;

-- Permitir que cualquier usuario (incluso anónimo) ejecute esta función
GRANT EXECUTE ON FUNCTION get_invitation_by_token(TEXT) TO anon, authenticated, service_role;
