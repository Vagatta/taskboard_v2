import { createClient } from '@supabase/supabase-js';

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

const supabaseUrl = getRequiredEnvVar('REACT_APP_SUPABASE_URL');
const supabaseAnonKey = getRequiredEnvVar('REACT_APP_SUPABASE_ANON_KEY');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

if (typeof window !== 'undefined') {
  window.supabase = supabase;
}
