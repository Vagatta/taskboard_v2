-- =====================================================
-- Migración: Agregar fecha de inicio (start_date) a tasks
-- para soporte de vista cronograma / Gantt
-- =====================================================

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS start_date DATE;

COMMENT ON COLUMN tasks.start_date IS 'Fecha de inicio planificada para la tarea (vista cronograma)';

-- Índice útil para filtrar tareas por rango de inicio
CREATE INDEX IF NOT EXISTS idx_tasks_start_date ON tasks(start_date);
