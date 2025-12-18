-- =====================================================
-- FUNCIÓN SEGURA PARA OBTENER INVITACIÓN POR TOKEN
-- =====================================================

-- Esta función permite obtener los detalles de una invitación usando solo el token.
-- Es SECURITY DEFINER para saltarse las políticas RLS restrictivas,
-- pero solo retorna datos si el token coincide exactamante.

CREATE OR REPLACE FUNCTION get_invitation_by_token(token_input TEXT)
RETURNS TABLE (
    id UUID,
    email TEXT,
    role TEXT,
    workspace_name TEXT,
    inviter_email TEXT,
    expires_at TIMESTAMPTZ,
    workspace_id UUID
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        wi.id,
        wi.email,
        wi.role,
        w.name as workspace_name,
        p.email as inviter_email,
        wi.expires_at,
        wi.workspace_id
    FROM workspace_invitations wi
    JOIN workspaces w ON w.id = wi.workspace_id
    LEFT JOIN profiles p ON p.id = wi.invited_by
    WHERE wi.token = token_input
    AND wi.accepted_at IS NULL
    AND wi.expires_at > NOW();
END;
$$;

-- Permitir que cualquier usuario (incluso anónimo) ejecute esta función
GRANT EXECUTE ON FUNCTION get_invitation_by_token(TEXT) TO anon, authenticated, service_role;
