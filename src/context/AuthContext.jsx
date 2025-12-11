import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, handleSupabaseError } from '../supabaseClient';

const AuthContext = createContext(undefined);

const initialState = {
  user: null,
  initializing: true,
  error: null,
  successMessage: null
};

export function AuthProvider({ children }) {
  const [state, setState] = useState(initialState);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchSession = async () => {
      try {
        const {
          data: { session },
          error
        } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (error) {
          setState((prev) => ({ ...prev, error: error.message }));
        }

        // Verificar si el usuario tiene el email confirmado
        const user = session?.user ?? null;
        if (user && !user.email_confirmed_at) {
          // Usuario no ha confirmado su email, cerrar sesión
          await supabase.auth.signOut();
          setState({
            user: null,
            initializing: false,
            error: 'Debes verificar tu email antes de acceder. Revisa tu bandeja de entrada.',
            successMessage: null
          });
          return;
        }

        setState({ user, initializing: false, error: error?.message ?? null, successMessage: null });
      } catch (error) {
        if (!isMounted) return;
        setState({ user: null, initializing: false, error: error instanceof Error ? error.message : String(error) });
      }
    };

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setState((prev) => ({ ...prev, user: session?.user ?? null }));
    });

    fetchSession();

    return () => {
      isMounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const signIn = async ({ email, password }) => {
    setAuthLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setAuthLoading(false);

    if (error) {
      const message = handleSupabaseError(error, 'No se pudo iniciar sesión');
      setState((prev) => ({ ...prev, error: message, successMessage: null }));
      throw error;
    }

    // Verificar si el email está confirmado
    if (data.user && !data.user.email_confirmed_at) {
      await supabase.auth.signOut();
      const message = 'Debes verificar tu email antes de acceder. Revisa tu bandeja de entrada.';
      setState((prev) => ({ ...prev, error: message, user: null, successMessage: null }));
      throw new Error(message);
    }

    setState((prev) => ({ ...prev, error: null, user: data.user, successMessage: null }));
    return data.user;
  };

  const signUp = async ({ email, password }) => {
    setAuthLoading(true);

    // Configurar URL de redirección para el email de verificación
    const redirectUrl = `${window.location.origin}${process.env.PUBLIC_URL || ''}`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    setAuthLoading(false);

    if (error) {
      const message = handleSupabaseError(error, 'No se pudo crear la cuenta');
      setState((prev) => ({ ...prev, error: message, successMessage: null }));
      throw error;
    }

    // Mostrar mensaje de éxito y NO establecer usuario (requiere verificación)
    const successMsg = '✓ Cuenta creada exitosamente. Revisa tu email para verificar tu cuenta antes de iniciar sesión.';
    setState((prev) => ({ ...prev, error: null, user: null, successMessage: successMsg }));
    return data.user;
  };

  const signOut = async () => {
    setAuthLoading(true);
    const { error } = await supabase.auth.signOut();
    setAuthLoading(false);

    if (error) {
      const message = handleSupabaseError(error, 'No se pudo cerrar sesión');
      setState((prev) => ({ ...prev, error: message, successMessage: null }));
      throw error;
    }

    setState((prev) => ({ ...prev, user: null, successMessage: null }));
  };

  const contextValue = useMemo(
    () => ({
      user: state.user,
      initializing: state.initializing,
      error: state.error,
      successMessage: state.successMessage,
      authLoading,
      signIn,
      signUp,
      signOut,
      setError: (message) => setState((prev) => ({ ...prev, error: message, successMessage: null })),
      setSuccessMessage: (message) => setState((prev) => ({ ...prev, successMessage: message, error: null }))
    }),
    [state.user, state.initializing, state.error, state.successMessage, authLoading]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }

  return context;
}


