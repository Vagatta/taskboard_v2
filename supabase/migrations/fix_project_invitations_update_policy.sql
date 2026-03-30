DROP POLICY IF EXISTS "Project owners and editors can update invitations" ON project_invitations;

CREATE POLICY "Project owners and editors can update invitations"
  ON project_invitations FOR UPDATE
  USING (
    project_id IN (
      SELECT project_id FROM project_members
      WHERE member_id = auth.uid()
      AND role IN ('owner', 'editor')
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT project_id FROM project_members
      WHERE member_id = auth.uid()
      AND role IN ('owner', 'editor')
    )
  );
