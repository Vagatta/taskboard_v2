-- =====================================================
-- MIGRACIÓN: Sistema de Invitaciones por Email
-- Descripción: Permite invitar usuarios no registrados a workspaces
-- Fecha: 2025-12-11
-- =====================================================

-- Tabla para almacenar invitaciones pendientes
CREATE TABLE IF NOT EXISTS workspace_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor',
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Validaciones
  CONSTRAINT valid_role CHECK (role IN ('owner', 'editor', 'viewer')),
  CONSTRAINT unique_pending_invitation UNIQUE (workspace_id, email)
);

-- Índices para mejorar rendimiento de búsquedas
CREATE INDEX IF NOT EXISTS idx_invitations_email ON workspace_invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON workspace_invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_workspace ON workspace_invitations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invitations_expires ON workspace_invitations(expires_at) WHERE accepted_at IS NULL;

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;

-- Los miembros del workspace pueden ver invitaciones de su workspace
CREATE POLICY "Workspace members can view invitations"
  ON workspace_invitations FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- Solo owners y editors pueden crear invitaciones
CREATE POLICY "Workspace owners and editors can create invitations"
  ON workspace_invitations FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'editor')
    )
  );

-- Solo quien invitó o los owners pueden cancelar invitaciones
CREATE POLICY "Inviter and owners can delete invitations"
  ON workspace_invitations FOR DELETE
  USING (
    invited_by = auth.uid() 
    OR 
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- =====================================================
-- FUNCIÓN: Procesar invitaciones pendientes
-- Se ejecuta automáticamente cuando un usuario se registra
-- =====================================================

CREATE OR REPLACE FUNCTION process_pending_invitations()
RETURNS TRIGGER AS $$
BEGIN
  -- Agregar usuario a workspaces donde tiene invitaciones pendientes válidas
  INSERT INTO workspace_members (workspace_id, user_id, role)
  SELECT 
    workspace_id,
    NEW.id,
    role
  FROM workspace_invitations
  WHERE email = NEW.email
    AND accepted_at IS NULL
    AND expires_at > NOW()
  ON CONFLICT (workspace_id, user_id) DO UPDATE
    SET role = EXCLUDED.role; -- Actualizar rol si ya existe
  
  -- Marcar invitaciones como aceptadas
  UPDATE workspace_invitations
  SET accepted_at = NOW()
  WHERE email = NEW.email
    AND accepted_at IS NULL
    AND expires_at > NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger que se ejecuta cuando se crea un perfil (usuario se registra)
DROP TRIGGER IF EXISTS on_profile_created_process_invitations ON profiles;
CREATE TRIGGER on_profile_created_process_invitations
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION process_pending_invitations();

-- =====================================================
-- FUNCIÓN: Limpiar invitaciones expiradas (opcional)
-- Ejecutar periódicamente con pg_cron o manualmente
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM workspace_invitations
  WHERE accepted_at IS NULL
    AND expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentarios para documentación
COMMENT ON TABLE workspace_invitations IS 'Almacena invitaciones pendientes para usuarios que aún no están registrados';
COMMENT ON COLUMN workspace_invitations.token IS 'Token único para el enlace de invitación';
COMMENT ON COLUMN workspace_invitations.expires_at IS 'Fecha de expiración de la invitación (por defecto 7 días)';
COMMENT ON FUNCTION process_pending_invitations() IS 'Procesa automáticamente invitaciones pendientes cuando un usuario se registra';
COMMENT ON FUNCTION cleanup_expired_invitations() IS 'Elimina invitaciones expiradas no aceptadas';
