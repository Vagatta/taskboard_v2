/**
 * Reproduce un sonido de éxito al completar tareas o acciones positivas.
 */
export const playSuccessSound = () => {
    // Usamos un sonido corto y suave de tipo "pop" o "success"
    try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
        audio.volume = 0.4;
        audio.play().catch(err => {
            // Silenciamos errores si el navegador bloquea el audio sin interacción previa
            console.debug('Audio feedback blocked by browser policies', err);
        });
    } catch (e) {
        console.error('Failed to initialize audio', e);
    }
};

/**
 * Reproduce un sonido de notificación sutil.
 */
export const playNotificationSound = () => {
    try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
        audio.volume = 0.3;
        audio.play().catch(() => { });
    } catch (e) { }
};
