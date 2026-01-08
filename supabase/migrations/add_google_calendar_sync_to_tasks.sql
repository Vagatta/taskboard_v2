-- =====================================================
-- MIGRACIÓN: Vincular tareas con eventos de Google Calendar
-- Descripción: Tabla para almacenar relación entre tasks y eventos de Google
-- =====================================================

-- Agregar columnas a la tabla tasks si no existen
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS google_event_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS synced_to_calendar BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS calendar_sync_at TIMESTAMPTZ;

-- Crear índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_tasks_google_event_id ON tasks(google_event_id);
CREATE INDEX IF NOT EXISTS idx_tasks_synced_to_calendar ON tasks(synced_to_calendar);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id_calendar ON tasks(project_id) WHERE synced_to_calendar = true;

-- Comentarios
COMMENT ON COLUMN tasks.google_event_id IS 'ID del evento en Google Calendar';
COMMENT ON COLUMN tasks.synced_to_calendar IS 'Indica si la tarea está sincronizada con Google Calendar';
COMMENT ON COLUMN tasks.calendar_sync_at IS 'Última fecha de sincronización con Google Calendar';
