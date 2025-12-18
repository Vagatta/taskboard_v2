-- =====================================================
-- DIAGNÓSTICO Y CORRECCIÓN - Políticas RLS para Invitaciones
-- =====================================================

-- 1. Verificar si el usuario actual es miembro de algún workspace
SELECT 
    w.name as workspace_name,
    wm.role,
    wm.user_id
FROM workspace_members wm
JOIN workspaces w ON w.id = wm.workspace_id
WHERE wm.user_id = auth.uid();

-- 2. Verificar políticas existentes
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'workspace_invitations';

-- 3. SOLUCIÓN: Eliminar y recrear políticas con mejor manejo de errores

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Workspace members can view invitations" ON workspace_invitations;
DROP POLICY IF EXISTS "Workspace owners and editors can create invitations" ON workspace_invitations;
DROP POLICY IF EXISTS "Inviter and owners can delete invitations" ON workspace_invitations;

-- Recrear política de SELECT (ver invitaciones)
CREATE POLICY "Workspace members can view invitations"
  ON workspace_invitations FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- Recrear política de INSERT con mejor validación
CREATE POLICY "Workspace owners and editors can create invitations"
  ON workspace_invitations FOR INSERT
  WITH CHECK (
    -- Verificar que el usuario autenticado sea el que invita
    invited_by = auth.uid()
    AND
    -- Verificar que el usuario sea owner o editor del workspace
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'editor')
    )
  );

-- Recrear política de DELETE
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

-- 4. Verificar que las políticas se crearon correctamente
SELECT 
    policyname,
    cmd as operation,
    CASE 
        WHEN cmd = 'SELECT' THEN 'Ver invitaciones'
        WHEN cmd = 'INSERT' THEN 'Crear invitaciones'
        WHEN cmd = 'DELETE' THEN 'Cancelar invitaciones'
    END as descripcion
FROM pg_policies
WHERE tablename = 'workspace_invitations'
ORDER BY cmd;
