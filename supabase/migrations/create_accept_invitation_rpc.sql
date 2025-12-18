-- =====================================================
-- FUNCIÓN PARA ACEPTAR INVITACIÓN (Para usuarios ya registrados)
-- =====================================================

CREATE OR REPLACE FUNCTION accept_invitation_by_token(token_input TEXT)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    invitation_record RECORD;
    current_user_id UUID;
    user_email TEXT;
BEGIN
    -- Obtener el ID del usuario actual
    current_user_id := auth.uid();
    
    -- Si no hay usuario autenticado, error
    IF current_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'No autenticado');
    END IF;

    -- Obtener email del usuario actual desde la tabla profiles
    SELECT email INTO user_email FROM profiles WHERE id = current_user_id;

    -- Buscar la invitación válida
    SELECT * INTO invitation_record 
    FROM workspace_invitations 
    WHERE token = token_input 
    AND accepted_at IS NULL 
    AND expires_at > NOW();

    -- Si no existe la invitación
    IF invitation_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Invitación no válida o expirada');
    END IF;

    -- Verificar que el email coincida
    IF invitation_record.email <> user_email THEN
        RETURN json_build_object('success', false, 'error', 'El email del usuario no coincide con la invitación');
    END IF;

    -- Insertar en workspace_members si no existe
    INSERT INTO workspace_members (workspace_id, user_id, role)
    VALUES (invitation_record.workspace_id, current_user_id, invitation_record.role)
    ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role;

    -- Marcar invitación como aceptada
    UPDATE workspace_invitations 
    SET accepted_at = NOW() 
    WHERE id = invitation_record.id;

    RETURN json_build_object('success', true, 'workspace_id', invitation_record.workspace_id);
END;
$$;

-- Permisos
GRANT EXECUTE ON FUNCTION accept_invitation_by_token(TEXT) TO authenticated;
