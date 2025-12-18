-- =====================================================
-- MIGRACIÓN: Sistema de Invitaciones por Email para Proyectos
-- Descripción: Permite invitar usuarios no registrados a proyectos
-- Fecha: 2025-12-12
-- =====================================================

-- Tabla para almacenar invitaciones pendientes a proyectos
CREATE TABLE IF NOT EXISTS project_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor',
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Validaciones
  CONSTRAINT valid_project_role CHECK (role IN ('owner', 'editor', 'viewer')),
  CONSTRAINT unique_pending_project_invitation UNIQUE (project_id, email)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_project_invitations_email ON project_invitations(email);
CREATE INDEX IF NOT EXISTS idx_project_invitations_token ON project_invitations(token);
CREATE INDEX IF NOT EXISTS idx_project_invitations_project ON project_invitations(project_id);
CREATE INDEX IF NOT EXISTS idx_project_invitations_expires ON project_invitations(expires_at) WHERE accepted_at IS NULL;

-- RLS
ALTER TABLE project_invitations ENABLE ROW LEVEL SECURITY;

-- Miembros del proyecto pueden ver invitaciones
-- Miembros del proyecto pueden ver invitaciones
DROP POLICY IF EXISTS "Project members can view invitations" ON project_invitations;
CREATE POLICY "Project members can view invitations"
  ON project_invitations FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM project_members 
      WHERE member_id = auth.uid()
    )
  );

-- Only owners and editors can create invitations
DROP POLICY IF EXISTS "Project owners and editors can create invitations" ON project_invitations;
CREATE POLICY "Project owners and editors can create invitations"
  ON project_invitations FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT project_id FROM project_members 
      WHERE member_id = auth.uid() 
      AND role IN ('owner', 'editor')
    )
  );

-- Inviter or owners can delete
DROP POLICY IF EXISTS "Inviter and owners can delete invitations" ON project_invitations;
CREATE POLICY "Inviter and owners can delete invitations"
  ON project_invitations FOR DELETE
  USING (
    invited_by = auth.uid() 
    OR 
    project_id IN (
      SELECT project_id FROM project_members 
      WHERE member_id = auth.uid() AND role = 'owner'
    )
  );

-- Function to process pending invitations on signup
CREATE OR REPLACE FUNCTION process_pending_project_invitations()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate if project_members table exists and insert
  -- Using ON CONFLICT to update role if already exists
  INSERT INTO project_members (project_id, member_id, role, member_email)
  SELECT 
    pi.project_id,
    NEW.id,
    pi.role,
    NEW.email
  FROM project_invitations pi
  WHERE pi.email = NEW.email
    AND pi.accepted_at IS NULL
    AND pi.expires_at > NOW()
  ON CONFLICT (project_id, member_id) DO UPDATE
    SET role = EXCLUDED.role;
  
  -- Mark as accepted
  UPDATE project_invitations
  SET accepted_at = NOW()
  WHERE email = NEW.email
    AND accepted_at IS NULL
    AND expires_at > NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on profiles created
DROP TRIGGER IF EXISTS on_profile_created_process_project_invitations ON profiles;
CREATE TRIGGER on_profile_created_process_project_invitations
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION process_pending_project_invitations();

COMMENT ON TABLE project_invitations IS 'Almacena invitaciones pendientes a proyectos';
