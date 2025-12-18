-- POLICY: Permitir usuarios ver workspaces donde tienen invitación
-- =====================================================

CREATE POLICY "Users can view workspaces they are invited to"
  ON workspaces FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_invitations
      WHERE workspace_invitations.workspace_id = workspaces.id
      AND workspace_invitations.email = (SELECT email FROM profiles WHERE id = auth.uid())
      AND workspace_invitations.accepted_at IS NULL
    )
  );
