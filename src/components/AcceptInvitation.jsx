import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Alert, Button, Card } from 'flowbite-react';

/**
 * Componente para aceptar invitaciones a workspaces
 * Se accede mediante: /?token=xxx
 */
export default function AcceptInvitation() {
    const [invitation, setInvitation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [user, setUser] = useState(null);

    // Obtener token de la URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    // Verificar si hay usuario autenticado
    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
        };
        checkUser();
    }, []);

    // Cargar información de la invitación
    useEffect(() => {
        loadInvitation();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadInvitation = async () => {
        if (!token) {
            setError('Token de invitación inválido');
            setLoading(false);
            return;
        }

        try {
            // Usar la función RPC segura para saltarse las restricciones RLS
            const { data, error: invError } = await supabase
                .rpc('get_invitation_by_token', { token_input: token });

            if (invError || !data || data.length === 0) {
                console.error('Error cargando invitación:', invError);
                setError('Invitación no encontrada o expirada');
                setLoading(false);
                return;
            }

            // La función retorna un array, tomamos el primero
            const invitationData = data[0];

            // Reconstruir la estructura que espera el componente
            setInvitation({
                ...invitationData,
                workspaces: { name: invitationData.workspace_name }
            });
            setLoading(false);
        } catch (err) {
            console.error('Error inesperado:', err);
            setError('Error al cargar la invitación');
            setLoading(false);
        }
    };

    // Traducir roles al español
    const getRoleLabel = (role) => {
        const roles = {
            owner: 'Propietario',
            editor: 'Editor',
            viewer: 'Lector'
        };
        return roles[role] || role;
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
            <Card className="max-w-md w-full shadow-xl">
                {loading ? (
                    <div className="text-center py-8">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mb-4"></div>
                        <p className="text-slate-600 dark:text-slate-400">Cargando invitación...</p>
                    </div>
                ) : error ? (
                    <div className="space-y-4">
                        <div className="text-center">
                            <svg className="mx-auto h-16 w-16 text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Invitación no válida</h2>
                        </div>
                        <Alert color="failure">{error}</Alert>
                        <div className="flex gap-2">
                            <Button onClick={() => window.location.href = '/Taskboard/'} color="light" className="flex-1">
                                Ir al inicio
                            </Button>
                        </div>
                    </div>
                ) : invitation ? (
                    <div className="space-y-6">
                        <div className="text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-cyan-100 dark:bg-cyan-900/30 mb-4">
                                <svg className="h-8 w-8 text-cyan-600 dark:text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                                ¡Has sido invitado!
                            </h2>
                        </div>

                        <div className="bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg p-4">
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                                Has sido invitado a unirte al workspace:
                            </p>
                            <p className="text-xl font-bold text-cyan-700 dark:text-cyan-300 mb-2">
                                {invitation.workspaces.name}
                            </p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                Rol asignado: <span className="font-semibold text-slate-900 dark:text-white">{getRoleLabel(invitation.role)}</span>
                            </p>
                        </div>

                        {user ? (
                            // Usuario ya autenticado
                            user.email === invitation.email ? (
                                <div className="space-y-4">
                                    <Alert color="success">
                                        <div className="flex items-center gap-2">
                                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                            <span>Estás autenticado con el email correcto.</span>
                                        </div>
                                    </Alert>
                                    <Button
                                        onClick={async () => {
                                            setLoading(true);
                                            try {
                                                const { data, error } = await supabase.rpc('accept_invitation_by_token', { token_input: token });
                                                if (error) throw error;
                                                if (!data.success) throw new Error(data.error);

                                                alert('¡Te has unido al workspace correctamente!');
                                                window.location.href = '/Taskboard/';
                                            } catch (err) {
                                                console.error(err);
                                                alert('Error al unirse: ' + (err.message || 'Error desconocido'));
                                            } finally {
                                                setLoading(false);
                                            }
                                        }}
                                        color="success"
                                        className="w-full"
                                        disabled={loading}
                                    >
                                        {loading ? 'Uniéndose...' : 'Unirse al Workspace ahora'}
                                    </Button>
                                </div>
                            ) : (
                                <Alert color="warning">
                                    Estás autenticado como <strong>{user.email}</strong>, pero la invitación es para <strong>{invitation.email}</strong>.
                                    Por favor, cierra sesión e inicia sesión con el email correcto.
                                </Alert>
                            )
                        ) : (
                            // Usuario no autenticado
                            <div className="space-y-3">
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    Para aceptar esta invitación, necesitas registrarte o iniciar sesión con el email:
                                </p>
                                <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3 text-center">
                                    <p className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
                                        {invitation.email}
                                    </p>
                                </div>
                                <Alert color="info">
                                    Una vez que te registres o inicies sesión, serás automáticamente agregado al workspace.
                                </Alert>
                            </div>
                        )}

                        <div className="flex flex-col gap-2">
                            <Button
                                onClick={() => window.location.href = '/Taskboard/'}
                                color="info"
                                className="w-full"
                            >
                                Ir a la aplicación
                            </Button>
                        </div>

                        <div className="text-center">
                            <p className="text-xs text-slate-500">
                                Esta invitación expira el {new Date(invitation.expires_at).toLocaleDateString('es-ES', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </p>
                        </div>
                    </div>
                ) : null}
            </Card>
        </div>
    );
}
