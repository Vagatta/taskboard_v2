import { supabase } from '../supabaseClient';

/**
 * Servicio para interactuar con Google Calendar a través de Supabase
 */

/**
 * Guardar token de Google después del OAuth
 */
export const saveGoogleToken = async (userId, accessToken, refreshToken, expiresIn) => {
  const expiresAt = new Date(Date.now() + (expiresIn || 3599) * 1000);
  
  const { data, error } = await supabase
    .from('google_calendar_tokens')
    .upsert(
      {
        user_id: userId,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt.toISOString(),
        sync_enabled: true
      },
      { onConflict: 'user_id' }
    )
    .select();

  if (error) throw error;
  return data?.[0];
};

/**
 * Obtener token de Google del usuario
 */
export const getGoogleToken = async (userId) => {
  const { data, error } = await supabase
    .from('google_calendar_tokens')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

/**
 * Sincronizar tarea con Google Calendar
 */
export const syncTaskToCalendar = async (taskId, taskData, userId) => {
  try {
    // Llamar a una Edge Function que maneje la sincronización
    const { data, error } = await supabase.functions.invoke('sync-task-to-calendar', {
      body: {
        taskId,
        taskData,
        userId
      }
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error sincronizando tarea a Google Calendar:', error);
    throw error;
  }
};

/**
 * Obtener eventos de Google Calendar
 */
export const getCalendarEvents = async (userId, calendarId = 'primary') => {
  try {
    const { data, error } = await supabase.functions.invoke('get-calendar-events', {
      body: {
        userId,
        calendarId
      }
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error obteniendo eventos de Google Calendar:', error);
    throw error;
  }
};

/**
 * Actualizar evento en Google Calendar
 */
export const updateCalendarEvent = async (userId, eventId, eventData) => {
  try {
    const { data, error } = await supabase.functions.invoke('update-calendar-event', {
      body: {
        userId,
        eventId,
        eventData
      }
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error actualizando evento en Google Calendar:', error);
    throw error;
  }
};

/**
 * Eliminar evento de Google Calendar
 */
export const deleteCalendarEvent = async (userId, eventId) => {
  try {
    const { data, error } = await supabase.functions.invoke('delete-calendar-event', {
      body: {
        userId,
        eventId
      }
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error eliminando evento de Google Calendar:', error);
    throw error;
  }
};

/**
 * Desconectar Google Calendar
 */
export const disconnectGoogleCalendar = async (userId) => {
  const { error } = await supabase
    .from('google_calendar_tokens')
    .delete()
    .eq('user_id', userId);

  if (error) throw error;
};

/**
 * Habilitar/Deshabilitar sincronización
 */
export const toggleCalendarSync = async (userId, enabled) => {
  const { data, error } = await supabase
    .from('google_calendar_tokens')
    .update({ sync_enabled: enabled })
    .eq('user_id', userId)
    .select();

  if (error) throw error;
  return data?.[0];
};
