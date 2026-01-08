-- =====================================================
-- MIGRACIÓN: Almacenar tokens de Google Calendar
-- Descripción: Tabla para guardar access_token y refresh_token de Google OAuth
-- =====================================================

CREATE TABLE IF NOT EXISTS google_calendar_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  calendar_id TEXT, -- ID del calendario principal del usuario
  sync_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_google_calendar_tokens_user_id ON google_calendar_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_google_calendar_tokens_expires_at ON google_calendar_tokens(expires_at);

-- RLS
ALTER TABLE google_calendar_tokens ENABLE ROW LEVEL SECURITY;

-- Política: los usuarios solo pueden ver/modificar sus propios tokens
DROP POLICY IF EXISTS "Users can manage their own calendar tokens" ON google_calendar_tokens;
CREATE POLICY "Users can manage their own calendar tokens"
  ON google_calendar_tokens
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Comentario
COMMENT ON TABLE google_calendar_tokens IS 'Almacena tokens de acceso a Google Calendar para sincronización de eventos';
