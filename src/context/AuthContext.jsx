import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, handleSupabaseError } from '../supabaseClient';

const AuthContext = createContext(undefined);

const initialState = {
  user: null,
  initializing: true,
  error: null
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

        setState({ user: session?.user ?? null, initializing: false, error: error?.message ?? null });
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
      setState((prev) => ({ ...prev, error: message }));
      throw error;
    }

    setState((prev) => ({ ...prev, error: null, user: data.user }));
    return data.user;
  };

  const signUp = async ({ email, password }) => {
    setAuthLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    setAuthLoading(false);

    if (error) {
      const message = handleSupabaseError(error, 'No se pudo crear la cuenta');
      setState((prev) => ({ ...prev, error: message }));
      throw error;
    }

    setState((prev) => ({ ...prev, error: null, user: data.user }));
    return data.user;
  };

  const signOut = async () => {
    setAuthLoading(true);
    const { error } = await supabase.auth.signOut();
    setAuthLoading(false);

    if (error) {
      const message = handleSupabaseError(error, 'No se pudo cerrar sesión');
      setState((prev) => ({ ...prev, error: message }));
      throw error;
    }

    setState((prev) => ({ ...prev, user: null }));
  };

  const contextValue = useMemo(
    () => ({
      user: state.user,
      initializing: state.initializing,
      error: state.error,
      authLoading,
      signIn,
      signUp,
      signOut,
      setError: (message) => setState((prev) => ({ ...prev, error: message }))
    }),
    [state.user, state.initializing, state.error, authLoading]
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
