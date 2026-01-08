import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { supabase, handleSupabaseError } from '../supabaseClient';

const AuthContext = createContext(undefined);

const initialState = {
  user: null,
  initializing: true,
  error: null,
  successMessage: null,
  requiresMFA: false,
  mfaUser: null,
  generatedCode: null // Código generado aleatoriamente
};

export function AuthProvider({ children }) {
  const [state, setState] = useState(initialState);
  const [authLoading, setAuthLoading] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    // Función para carga inicial de la sesión
    const fetchSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!isMounted.current) return;

        if (error) {
          console.error('[AuthDebug] Error en getSession:', error);
        }

        const user = session?.user ?? null;
        console.log('[AuthDebug] Initial Session Fetch:', user?.email);

        // Si el usuario no está verificado, lo dejamos pasar por ahora pero el listener lo cerrará
        // para evitar bloqueos en el INITIAL_SESSION
        setState(prev => ({ ...prev, user, initializing: false }));
      } catch (err) {
        console.error('[AuthDebug] Catch en fetchSession:', err);
        if (isMounted.current) {
          setState(prev => ({ ...prev, initializing: false }));
        }
      }
    };

    // Suscribirse a cambios de estado de autenticación
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted.current) return;

      const user = session?.user ?? null;
      console.log('[AuthDebug] onAuthStateChange Event:', _event, 'User:', user?.email);

      // Limpiar el fragmento de la URL después de procesar el login
      if (_event === 'SIGNED_IN' && window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname);
      }

      // Proceso especial para SIGNED_IN con Google
      if (user && _event === 'SIGNED_IN' && user.app_metadata?.provider === 'google') {
        try {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (currentSession?.provider_token) {
            const expiresIn = currentSession.expires_in || 3599;
            await supabase
              .from('google_calendar_tokens')
              .upsert(
                {
                  user_id: user.id,
                  access_token: currentSession.provider_token,
                  refresh_token: currentSession.provider_refresh_token,
                  expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
                  sync_enabled: true
                },
                { onConflict: 'user_id' }
              );
            console.log('[AuthDebug] Google token guardado');
          }
        } catch (err) {
          console.error('[AuthDebug] Error guardando Google token:', err);
        }
      }

      // Validación de email confirmado
      if (user && !user.email_confirmed_at) {
        console.warn('[AuthDebug] Usuario sin confirmar, cerrando sesión...');
        await supabase.auth.signOut();
        setState({
          user: null,
          initializing: false,
          error: 'Debes verificar tu email antes de acceder. Revisa tu bandeja de entrada.',
          successMessage: null
        });
        return;
      }

      // Establecer el estado final y marcar como inicializado
      setState({
        user,
        initializing: false,
        error: null,
        successMessage: null,
        requiresMFA: false,
        mfaUser: null,
        generatedCode: null
      });
    });

    fetchSession();

    return () => {
      isMounted.current = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async ({ email, password }) => {
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

    // Simulación de Alerta de Nuevo Dispositivo
    if (data.user?.user_metadata?.newDeviceAlerts) {
      setState((prev) => ({ ...prev, successMessage: `✓ Se ha enviado una alerta de inicio de sesión a ${email}.` }));
    }

    // Simulación de MFA
    if (data.user?.user_metadata?.mfa) {
      // Comprobar si este dispositivo es de confianza
      const trustToken = localStorage.getItem(`trusted_device_${data.user.id}`);
      if (trustToken) {
        // En una implementación real verificaríamos la validez del token en el servidor
        setState((prev) => ({ ...prev, error: null, user: data.user, successMessage: state.successMessage || null }));
        return data.user;
      }

      const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
      setState((prev) => ({ ...prev, requiresMFA: true, mfaUser: data.user, generatedCode: randomCode, user: null }));

      // Simular envío de código (mostrándolo al usuario)
      alert(`[DEMO MFA] Tu código de acceso es: ${randomCode}\n(Simulando envío a ${email})`);

      return { mfaRequired: true };
    }

    setState((prev) => ({ ...prev, error: null, user: data.user, successMessage: state.successMessage || null }));
    return data.user;
  }, [state.successMessage]);

  const verifyMFA = useCallback(async (code, rememberDevice = false) => {
    if (code === state.generatedCode) {
      const user = state.mfaUser;

      if (rememberDevice && user) {
        // Guardar token de confianza (usamos el ID de usuario como token simple para esta demo)
        localStorage.setItem(`trusted_device_${user.id}`, `trusted_${Date.now()}`);
      }

      setState((prev) => ({
        ...prev,
        user,
        requiresMFA: false,
        mfaUser: null,
        generatedCode: null,
        successMessage: '✓ Verificación MFA correcta.'
      }));
      return user;
    } else {
      throw new Error('Código MFA incorrecto');
    }
  }, [state.generatedCode, state.mfaUser]);

  const signUp = useCallback(async ({ email, password }) => {
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
  }, []);

  const signOut = useCallback(async () => {
    setAuthLoading(true);
    const { error } = await supabase.auth.signOut();
    setAuthLoading(false);

    if (error) {
      const message = handleSupabaseError(error, 'No se pudo cerrar sesión');
      setState((prev) => ({ ...prev, error: message, successMessage: null }));
      throw error;
    }

    setState((prev) => ({ ...prev, user: null, successMessage: null }));
  }, []);

  const loginWithGoogle = useCallback(async () => {
    setAuthLoading(true);
    try {
      // Usar URL dinámica basada en el entorno actual para evitar mismatch en local/prod
      const redirectUrl = `${window.location.origin}${process.env.PUBLIC_URL || ''}`;
      console.log('[AuthDebug] Iniciando login con Google. Redirect URL:', redirectUrl);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'openid profile email',
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('[AuthDebug] Google OAuth error:', error);
        const message = handleSupabaseError(error, 'No se pudo iniciar sesión con Google');
        setState((prev) => ({ ...prev, error: message, successMessage: null }));
        throw error;
      }
    } catch (err) {
      console.error('[AuthDebug] Catch en loginWithGoogle:', err);
    } finally {
      if (isMounted.current) {
        setAuthLoading(false);
      }
    }
  }, []);

  const contextValue = useMemo(
    () => ({
      user: state.user,
      initializing: state.initializing,
      error: state.error,
      successMessage: state.successMessage,
      requiresMFA: state.requiresMFA,
      authLoading,
      signIn,
      signUp,
      signOut,
      verifyMFA,
      loginWithGoogle,
      setError: (message) => setState((prev) => ({ ...prev, error: message, successMessage: null })),
      setSuccessMessage: (message) => setState((prev) => ({ ...prev, successMessage: message, error: null })),
      cancelMFA: () => setState((prev) => ({ ...prev, requiresMFA: false, mfaUser: null }))
    }),
    [
      state.user,
      state.initializing,
      state.error,
      state.successMessage,
      state.requiresMFA,
      authLoading,
      signIn,
      signUp,
      signOut,
      verifyMFA,
      loginWithGoogle
    ]
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


