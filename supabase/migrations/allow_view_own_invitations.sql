-- =====================================================
-- POLICY: Permitir usuarios ver sus propias invitaciones
-- =====================================================

CREATE OR REPLACE FUNCTION get_auth_email()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid();
$$;

-- Crear política para que invitados puedan ver sus propias invitaciones pendientes
CREATE POLICY "Users can view invitations sent to their email"
  ON workspace_invitations FOR SELECT
  USING (
    email = (SELECT email FROM profiles WHERE id = auth.uid()) OR 
    email = auth.jwt() ->> 'email'
  );
