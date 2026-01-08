import { useState, useEffect } from 'react';
import { Button } from 'flowbite-react';

export default function CookieConsent() {
    const [showConsent, setShowConsent] = useState(false);
    const [openModal, setOpenModal] = useState(false);

    useEffect(() => {
        // Verificar si ya se aceptaron las cookies
        const consent = document.cookie
            .split('; ')
            .find(row => row.startsWith('cookie_consent_accepted='));

        if (!consent) {
            // Mostrar el banner con un pequeño retraso para mejorar la UX
            const timer = setTimeout(() => setShowConsent(true), 1500);
            return () => clearTimeout(timer);
        }
    }, []);

    const acceptCookies = () => {
        // Establecer la cookie de consentimiento por 1 año
        const date = new Date();
        date.setFullYear(date.getFullYear() + 1);
        document.cookie = `cookie_consent_accepted=true; expires=${date.toUTCString()}; path=/; SameSite=Lax`;
        setShowConsent(false);
    };

    if (!showConsent) return null;

    return (
        <>
            <div className="fixed bottom-0 left-0 right-0 z-[100] animate-in fade-in slide-in-from-bottom-full duration-700">
                <div className="border-t border-white/20 bg-slate-900/90 p-4 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/95">
                    <div className="mx-auto max-w-7xl">
                        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between px-2">
                            <div className="flex items-center gap-4 text-center sm:text-left">
                                <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400 sm:flex">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                                        <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
                                        <path d="M8.5 8.5v.01M16 15.5v.01M12 18v.01M7 15v.01" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-white">
                                        Utilizamos cookies para gestionar tu sesión y mejorar tu experiencia.
                                        <button
                                            onClick={() => setOpenModal(true)}
                                            className="ml-1 text-sky-400 hover:underline focus:outline-none"
                                        >
                                            Más info
                                        </button>
                                    </p>
                                </div>
                            </div>
                            <div className="flex w-full shrink-0 items-center justify-center gap-3 sm:w-auto">
                                <Button
                                    onClick={acceptCookies}
                                    size="sm"
                                    className="w-full sm:w-auto bg-sky-500 hover:bg-sky-600 border-none transition-all active:scale-95 px-8"
                                >
                                    Aceptar
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {openModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/20 bg-slate-900 shadow-2xl">
                        <div className="border-b border-white/10 bg-slate-900 px-6 py-4 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white">Información sobre Cookies</h2>
                            <button onClick={() => setOpenModal(false)} className="text-slate-400 hover:text-white">
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="max-h-[70vh] overflow-y-auto px-6 py-6 text-slate-300">
                            <div className="space-y-6">
                                <section>
                                    <h3 className="mb-2 text-lg font-semibold text-sky-400">¿Qué cookies utilizamos?</h3>
                                    <p className="text-sm leading-relaxed">
                                        Para que Taskboard funcione correctamente, necesitamos utilizar algunas cookies técnicas y de sesión. No utilizamos estas cookies para fines publicitarios.
                                    </p>
                                </section>

                                <div className="space-y-4">
                                    <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                                        <h4 className="mb-1 text-sm font-bold text-white uppercase tracking-wider">Cookies Esenciales</h4>
                                        <p className="text-xs text-slate-400">
                                            Gestionadas por Supabase para mantener tu sesión activa de forma segura. Sin estas cookies, no podrías iniciar sesión ni acceder a tus tableros.
                                        </p>
                                    </div>

                                    <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                                        <h4 className="mb-1 text-sm font-bold text-white uppercase tracking-wider">Cookies de Proveedor (Google)</h4>
                                        <p className="text-xs text-slate-400">
                                            Si utilizas el acceso con Google, se emplean cookies para verificar tu identidad y otorgar acceso a la aplicación.
                                        </p>
                                    </div>

                                    <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                                        <h4 className="mb-1 text-sm font-bold text-white uppercase tracking-wider">Funcionalidad</h4>
                                        <p className="text-xs text-slate-400">
                                            Guardamos tus preferencias visuales, como el modo oscuro o claro, para que se mantengan cada vez que regresas.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-white/10 bg-slate-900/50 px-6 py-4">
                            <button
                                onClick={() => setOpenModal(false)}
                                className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
                            >
                                Cerrar
                            </button>
                            <Button
                                onClick={() => {
                                    acceptCookies();
                                    setOpenModal(false);
                                }}
                                className="bg-sky-500 hover:bg-sky-600 border-none px-6"
                                size="sm"
                            >
                                Entendido y Aceptar
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
