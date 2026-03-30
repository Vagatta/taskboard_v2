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
  generatedCode: typeof window !== 'undefined' ? sessionStorage.getItem('mfa_generated_code') : null
};

export function AuthProvider({ children }) {
  const [state, setState] = useState(initialState);
  const [authLoading, setAuthLoading] = useState(false);
  const lastAuthUpdateRef = useRef({ userId: null, requiresMFA: false, initializing: true });
  const lastMfaEmailSentRef = useRef({ userId: null, timestamp: 0 });

  // Helper para verificar confianza del dispositivo
  const checkIsTrusted = useCallback((userId) => {
    if (!userId) return false;
    const trustData = localStorage.getItem(`trusted_device_${userId}`);
    if (!trustData) return false;
    try {
      const { timestamp } = JSON.parse(trustData);
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      if (Date.now() - timestamp < thirtyDays) return true;
      console.log('[AuthDebug] Token de confianza expirado (30 días)');
      localStorage.removeItem(`trusted_device_${userId}`);
    } catch (e) {
      localStorage.removeItem(`trusted_device_${userId}`);
    }
    return false;
  }, []);

  // Función centralizada para enviar el código MFA
  const sendMFACode = useCallback(async (mfaUser, email) => {
    if (!mfaUser || !email) return;

    setAuthLoading(true);
    const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
    const displayName = mfaUser.user_metadata?.full_name || email.split('@')[0];

    try {
      console.log('[AuthContext] Preparando envío de código MFA a:', email);
      const { data, error: mfaError } = await supabase.functions.invoke('send-mfa-code', {
        body: {
          email: email,
          code: randomCode,
          name: displayName
        }
      });

      console.log('[AuthContext] Respuesta de send-mfa-code:', { data, error: mfaError });

      if (mfaError) throw mfaError;
      if (data && data.success === false) {
        throw new Error(data.error || 'Error desconocido en la entrega del código');
      }

      // Guardar en sessionStorage para sobrevivir a refrescos
      sessionStorage.setItem('mfa_generated_code', randomCode);
      sessionStorage.setItem('mfa_last_sent_timestamp', Date.now().toString());

      setState((prev) => ({
        ...prev,
        requiresMFA: true,
        mfaUser: mfaUser,
        generatedCode: randomCode,
        user: null,
        successMessage: `✓ Se ha enviado un nuevo código de seguridad a ${email}`
      }));
      return true;
    } catch (err) {
      console.error('[AuthContext] Error enviando MFA:', err);
      const message = err.message || 'No se pudo enviar el código de seguridad. Verifica tu conexión o contacta a soporte.';
      setState((prev) => ({ ...prev, error: message }));
      return false;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const handleAuthStateChange = async (event, session) => {
      if (!isMounted) return;
      const user = session?.user ?? null;
      const appMeta = user?.app_metadata || {};
      const userMeta = user?.user_metadata || {};

      const mfaEnabled = userMeta.mfa === true || userMeta.mfa === 'true';
      const isVerified = user ? sessionStorage.getItem(`mfa_verified_${user.id}`) : null;
      const isTrusted = checkIsTrusted(user?.id);
      const needsMFA = mfaEnabled && !isVerified && !isTrusted;

      // VERSIÓN 4: Registro síncrono para evitar procesamiento paralelo de INITIAL_SESSION y SIGNED_IN
      const now = Date.now();
      const lastUpdate = lastAuthUpdateRef.current;

      // Bloquear si es exactamente la misma actualización y ocurrió hace menos de 100ms
      if (
        lastUpdate.userId === user?.id &&
        lastUpdate.requiresMFA === (needsMFA ? true : false) &&
        lastUpdate.initializing === false &&
        (now - lastUpdate.timestamp < 100) &&
        event !== 'SIGNED_OUT'
      ) {
        return;
      }

      // Actualización atómica de la referencia
      lastAuthUpdateRef.current = {
        userId: user?.id,
        requiresMFA: needsMFA,
        initializing: false,
        timestamp: now
      };

      console.log(`[AuthDebug-V4] Event: ${event} | User: ${user?.email || 'none'} | NeedsMFA: ${needsMFA} | Provider: ${appMeta.provider || appMeta.providers?.join(',')}`);

      // Si el usuario se autentica con Google, guardar el token
      if (user && event === 'SIGNED_IN' && user.app_metadata?.provider === 'google') {
        try {
          // No necesitamos volver a pedir sesión si ya la tenemos en el evento
          if (session?.provider_token) {
            const expiresIn = session.expires_in || 3599;
            await supabase
              .from('google_calendar_tokens')
              .upsert(
                {
                  user_id: user.id,
                  access_token: session.provider_token,
                  refresh_token: session.provider_refresh_token,
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

      // Verificar email confirmado
      if (user && !user.email_confirmed_at) {
        await supabase.auth.signOut();
        setState(prev => ({
          ...prev,
          user: null,
          initializing: false,
          error: 'Debes verificar tu email antes de acceder.'
        }));
        return;
      }

      // Gestionar MFA
      if (needsMFA) {
        console.log(`[AuthDebug] Bloqueando acceso por MFA requerido | Evento: ${event}`);

        // Evitar múltiples envíos automáticos (cooldown de 60 segundos persistente)
        const lastSent = sessionStorage.getItem('mfa_last_sent_timestamp');
        const cooldown = 60000; // 60s
        const inCooldown = lastSent && (Date.now() - parseInt(lastSent) < cooldown);

        // SOLO enviar automáticamente en SIGNED_IN (nuevo login)
        // En INITIAL_SESSION (F5) simplemente mostramos la pantalla de MFA reusando el código anterior
        if (event === 'SIGNED_IN' && !authLoading && !inCooldown) {
          console.log('[AuthDebug] Activando envío automático de MFA por nuevo SIGNED_IN');
          sessionStorage.setItem('mfa_last_sent_timestamp', Date.now().toString());
          lastMfaEmailSentRef.current = { userId: user.id, timestamp: Date.now() };

          setTimeout(() => {
            sendMFACode(user, user.email);
          }, 100);
        } else if (event === 'INITIAL_SESSION') {
          console.log('[AuthDebug] Restaurando pantalla de MFA (sin re-enviar email automáticamente)');
        }

        setState(prev => ({
          ...prev,
          requiresMFA: true,
          mfaUser: user,
          user: null,
          initializing: false
        }));
      } else {
        setState(prev => ({
          ...prev,
          user,
          requiresMFA: false,
          mfaUser: null,
          initializing: false,
          error: null
        }));
      }
    };

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      handleAuthStateChange(event, session);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      handleAuthStateChange('INITIAL_SESSION', session);
    });

    return () => {
      isMounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, [authLoading, checkIsTrusted, sendMFACode]);

  const resendMFACode = useCallback(async () => {
    if (state.mfaUser && (state.mfaUser.email || state.mfaUser.user_metadata?.email)) {
      const email = state.mfaUser.email || state.mfaUser.user_metadata.email;
      return await sendMFACode(state.mfaUser, email);
    }
    return false;
  }, [state.mfaUser, sendMFACode]);

  const signIn = useCallback(async ({ email, password }) => {
    setAuthLoading(true);
    // Limpiar estados previos antes de intentar nuevo login
    setState((prev) => ({ ...prev, error: null, successMessage: null }));

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setAuthLoading(false);

    if (error) {
      const message = handleSupabaseError(error, 'No se pudo iniciar sesión');
      setState((prev) => ({ ...prev, error: message, successMessage: null }));
      throw error;
    }

    // Verificar si el email está confirmado
    if (data.user && !data.user.email_confirmed_at) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('[Auth] Error al cerrar sesión tras email no confirmado:', e);
      }
      const message = 'Debes verificar tu email antes de acceder. Revisa tu bandeja de entrada.';
      setState((prev) => ({ ...prev, error: message, user: null, successMessage: null }));
      throw new Error(message);
    }

    // Simulación de MFA -> ¡Ahora real!
    const userMeta = data.user?.user_metadata || {};
    const mfaEnabled = userMeta.mfa === true || userMeta.mfa === 'true';

    if (mfaEnabled) {
      const isTrusted = checkIsTrusted(data.user.id);

      const isVerified = sessionStorage.getItem(`mfa_verified_${data.user.id}`);

      if (!isTrusted && !isVerified) {
        const mfaLock = lastMfaEmailSentRef.current;
        const cooldown = 60000;

        if (mfaLock.userId !== data.user.id || Date.now() - mfaLock.timestamp > cooldown) {
          console.log('[AuthContext-SignIn] MFA requerido, enviando código...');
          lastMfaEmailSentRef.current = { userId: data.user.id, timestamp: Date.now() };
          await sendMFACode(data.user, email);
          return { mfaRequired: true };
        } else {
          console.log('[AuthContext-SignIn] MFA requerido pero omitido (cooldown activo)');
          return { mfaRequired: true };
        }
      } else {
        console.log('[AuthContext-SignIn] MFA omitido por dispositivo seguro o sesión activa');
      }
    }

    setState((prev) => ({ ...prev, error: null, user: data.user, successMessage: state.successMessage || null }));
    return data.user;
  }, [sendMFACode, state.successMessage, checkIsTrusted]);

  const verifyMFA = useCallback(async (code, rememberDevice = false) => {
    console.log('[AuthContext] Verificando código:', { code, expected: state.generatedCode });
    if (code === state.generatedCode) {
      const user = state.mfaUser;

      if (rememberDevice && user) {
        // Guardar token de confianza con timestamp para los 30 días
        localStorage.setItem(`trusted_device_${user.id}`, JSON.stringify({
          trusted: true,
          timestamp: Date.now()
        }));
      }

      sessionStorage.setItem(`mfa_verified_${user.id}`, 'true');
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
    try {
      // Intentar cerrar sesión solo si hay una sesión activa
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { error } = await supabase.auth.signOut();
        if (error && error.name !== 'AuthSessionMissingError') {
          throw error;
        }
      }
    } catch (error) {
      console.warn('[Auth] Error controlado al cerrar sesión:', error);
      // No mostramos error al usuario por sesion faltante al salir
      if (error.name !== 'AuthSessionMissingError') {
        const message = handleSupabaseError(error, 'No se pudo cerrar sesión');
        setState((prev) => ({ ...prev, error: message, successMessage: null }));
      }
    } finally {
      setAuthLoading(false);
      setState((prev) => ({
        ...prev,
        user: null,
        successMessage: null,
        error: null,
        requiresMFA: false,
        mfaUser: null,
        generatedCode: null
      }));
      // Limpiar rastro de MFA en la sesión local
      sessionStorage.clear();
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'openid profile email',
          redirectTo: 'https://cloud.kuchen.es/Taskboard/',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('Google OAuth error:', error);
        const message = handleSupabaseError(error, 'No se pudo iniciar sesión con Google');
        setState((prev) => ({ ...prev, error: message, successMessage: null }));
        throw error;
      }
    } finally {
      setAuthLoading(false);
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
      resendMFACode,
      loginWithGoogle,
      setError: (message) => setState((prev) => ({ ...prev, error: message, successMessage: null })),
      setSuccessMessage: (message) => setState((prev) => ({ ...prev, successMessage: message, error: null })),
      cancelMFA: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            await supabase.auth.signOut();
          }
        } catch (e) {
          console.warn('[Auth] Error al cancelar MFA:', e);
        }
        setState((prev) => ({
          ...prev,
          requiresMFA: false,
          mfaUser: null,
          user: null,
          successMessage: null,
          error: null,
          generatedCode: null
        }));
        sessionStorage.clear();
      }
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
      resendMFACode,
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


