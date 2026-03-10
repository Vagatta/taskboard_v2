-- Custom boards per project
-- Each project can have multiple boards, each with custom columns.
-- Tasks are assigned to columns with a position for ordering.

CREATE TABLE IF NOT EXISTS project_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Nuevo tablón',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_board_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES project_boards(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_board_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  column_id uuid NOT NULL REFERENCES project_board_columns(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(column_id, task_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_project_boards_project ON project_boards(project_id);
CREATE INDEX IF NOT EXISTS idx_board_columns_board ON project_board_columns(board_id);
CREATE INDEX IF NOT EXISTS idx_board_tasks_column ON project_board_tasks(column_id);
CREATE INDEX IF NOT EXISTS idx_board_tasks_task ON project_board_tasks(task_id);

-- RLS
ALTER TABLE project_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_board_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_board_tasks ENABLE ROW LEVEL SECURITY;

-- Policies: project members can manage boards
CREATE POLICY "Members can view project boards"
  ON project_boards FOR SELECT
  USING (
    project_id IN (
      SELECT pm.project_id FROM project_members pm WHERE pm.member_id = auth.uid()
    )
    OR created_by = auth.uid()
    OR project_id IN (SELECT p.id FROM projects p WHERE p.user_id = auth.uid())
  );

CREATE POLICY "Members can insert project boards"
  ON project_boards FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT pm.project_id FROM project_members pm WHERE pm.member_id = auth.uid()
    )
    OR project_id IN (SELECT p.id FROM projects p WHERE p.user_id = auth.uid())
  );

CREATE POLICY "Members can update project boards"
  ON project_boards FOR UPDATE
  USING (
    project_id IN (
      SELECT pm.project_id FROM project_members pm WHERE pm.member_id = auth.uid()
    )
    OR created_by = auth.uid()
    OR project_id IN (SELECT p.id FROM projects p WHERE p.user_id = auth.uid())
  );

CREATE POLICY "Members can delete project boards"
  ON project_boards FOR DELETE
  USING (
    created_by = auth.uid()
    OR project_id IN (SELECT p.id FROM projects p WHERE p.user_id = auth.uid())
  );

-- Board columns inherit board access
CREATE POLICY "Members can view board columns"
  ON project_board_columns FOR SELECT
  USING (
    board_id IN (SELECT b.id FROM project_boards b)
  );

CREATE POLICY "Members can insert board columns"
  ON project_board_columns FOR INSERT
  WITH CHECK (
    board_id IN (SELECT b.id FROM project_boards b)
  );

CREATE POLICY "Members can update board columns"
  ON project_board_columns FOR UPDATE
  USING (
    board_id IN (SELECT b.id FROM project_boards b)
  );

CREATE POLICY "Members can delete board columns"
  ON project_board_columns FOR DELETE
  USING (
    board_id IN (SELECT b.id FROM project_boards b)
  );

-- Board tasks inherit column access
CREATE POLICY "Members can view board tasks"
  ON project_board_tasks FOR SELECT
  USING (
    column_id IN (SELECT c.id FROM project_board_columns c)
  );

CREATE POLICY "Members can insert board tasks"
  ON project_board_tasks FOR INSERT
  WITH CHECK (
    column_id IN (SELECT c.id FROM project_board_columns c)
  );

CREATE POLICY "Members can update board tasks"
  ON project_board_tasks FOR UPDATE
  USING (
    column_id IN (SELECT c.id FROM project_board_columns c)
  );

CREATE POLICY "Members can delete board tasks"
  ON project_board_tasks FOR DELETE
  USING (
    column_id IN (SELECT c.id FROM project_board_columns c)
  );
