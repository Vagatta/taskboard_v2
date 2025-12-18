-- =====================================================
-- FUNCIÓN PARA ACEPTAR INVITACIÓN DE PROYECTO (Para usuarios ya registrados)
-- =====================================================

CREATE OR REPLACE FUNCTION accept_project_invitation_by_token(token_input TEXT)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    invitation_record RECORD;
    current_user_id UUID;
    user_email TEXT;
    target_workspace_id UUID;
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
    FROM project_invitations 
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

    -- Insertar en project_members si no existe
    INSERT INTO project_members (project_id, member_id, role, member_email)
    VALUES (invitation_record.project_id, current_user_id, invitation_record.role, user_email)
    ON CONFLICT (project_id, member_id) DO UPDATE SET role = EXCLUDED.role;

    -- Obtener el workspace_id del proyecto
    SELECT workspace_id INTO target_workspace_id FROM projects WHERE id = invitation_record.project_id;

    -- Asegurar que el usuario sea miembro del workspace (al menos viewer) para poder acceder
    IF target_workspace_id IS NOT NULL THEN
        INSERT INTO workspace_members (workspace_id, user_id, role)
        VALUES (target_workspace_id, current_user_id, 'viewer')
        ON CONFLICT (workspace_id, user_id) DO NOTHING;
    END IF;

    -- Marcar invitación como aceptada
    UPDATE project_invitations 
    SET accepted_at = NOW() 
    WHERE id = invitation_record.id;

    RETURN json_build_object('success', true, 'project_id', invitation_record.project_id);
END;
$$;

-- Permisos
GRANT EXECUTE ON FUNCTION accept_project_invitation_by_token(TEXT) TO authenticated;
