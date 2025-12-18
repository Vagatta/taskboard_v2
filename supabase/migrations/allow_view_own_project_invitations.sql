-- =====================================================
-- POLICY: Permitir usuarios ver sus propias invitaciones a proyectos
-- =====================================================

-- Asegurarse de habilitar RLS (ya hecho en create_project_invitations, pero por si acaso)
ALTER TABLE project_invitations ENABLE ROW LEVEL SECURITY;

-- Crear política para que invitados puedan ver sus propias invitaciones pendientes
DROP POLICY IF EXISTS "Users can view project invitations sent to their email" ON project_invitations;
CREATE POLICY "Users can view project invitations sent to their email"
  ON project_invitations FOR SELECT
  USING (
    email = (SELECT email FROM profiles WHERE id = auth.uid()) OR 
    email = auth.jwt() ->> 'email'
  );
