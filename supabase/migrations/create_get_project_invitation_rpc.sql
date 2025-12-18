-- =====================================================
-- FUNCIÓN SEGURA PARA OBTENER INVITACIÓN DE PROYECTO POR TOKEN
-- =====================================================

CREATE OR REPLACE FUNCTION get_project_invitation_by_token(token_input TEXT)
RETURNS TABLE (
    id UUID,
    email TEXT,
    role TEXT,
    project_name TEXT,
    inviter_email TEXT,
    expires_at TIMESTAMPTZ,
    project_id UUID
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pi.id,
        pi.email,
        pi.role,
        p.name as project_name,
        prof.email as inviter_email,
        pi.expires_at,
        pi.project_id
    FROM project_invitations pi
    JOIN projects p ON p.id = pi.project_id
    LEFT JOIN profiles prof ON prof.id = pi.invited_by
    WHERE pi.token = token_input
    AND pi.accepted_at IS NULL
    AND pi.expires_at > NOW();
END;
$$;

-- Permitir que cualquier usuario (incluso anónimo) ejecute esta función
GRANT EXECUTE ON FUNCTION get_project_invitation_by_token(TEXT) TO anon, authenticated, service_role;
