import { createClient } from '@supabase/supabase-js';
import { spanishAuthMessagesByCode } from './utils/authErrorMessages';

const getRequiredEnvVar = (name) => {
  const value = process.env[name];

  if (!value) {
    const message = `Supabase: la variable de entorno ${name} es obligatoria.`;
    // eslint-disable-next-line no-console
    console.error(message);
    throw new Error(message);
  }

  return value;
};

const isBrowser = typeof window !== 'undefined';

const supabaseUrl = getRequiredEnvVar('REACT_APP_SUPABASE_URL');
const supabaseAnonKey = getRequiredEnvVar('REACT_APP_SUPABASE_ANON_KEY');

// El cliente de Supabase ahora usa el almacenamiento por defecto (localStorage)
// para evitar las limitaciones de tamaño de las cookies (4KB) que causaban problemas con Google OAuth.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'taskboard-v2-auth-token'
  }
});

if (typeof window !== 'undefined') {
  window.supabase = supabase;
}

export const handleSupabaseError = (error, fallbackMessage = 'Ha ocurrido un error con Supabase') => {
  if (!error) {
    return;
  }

  // eslint-disable-next-line no-console
  console.error('Supabase error:', error);

  let message = fallbackMessage;

  if (error.code && spanishAuthMessagesByCode[error.code]) {
    message = spanishAuthMessagesByCode[error.code];
  } else if (typeof error.message === 'string' && error.message.trim()) {
    message = error.message;
  }

  return message;
};
