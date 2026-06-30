import { createContext, useContext, useState, useCallback, useRef } from 'react';

// API context never changes reference — components using useToast won't re-render
const ToastApiContext = createContext(null);
// State context only consumed by ToastContainer
const ToastStateContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  // Ref stores latest setToasts so callbacks never change reference
  const setToastsRef = useRef(setToasts);
  setToastsRef.current = setToasts;

  const removeToast = useCallback((id) => {
    setToastsRef.current((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'error', duration = 5000) => {
    const id = Date.now() + Math.random();
    setToastsRef.current((prev) => [...prev, { id, message, type, duration }]);
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
    return id;
  }, [removeToast]);

  // API object reference is stable forever
  const apiRef = useRef({
    addToast,
    removeToast,
    success: (message, duration) => addToast(message, 'success', duration),
    error: (message, duration) => addToast(message, 'error', duration),
    info: (message, duration) => addToast(message, 'info', duration),
    warning: (message, duration) => addToast(message, 'warning', duration),
  });

  return (
    <ToastApiContext.Provider value={apiRef.current}>
      <ToastStateContext.Provider value={toasts}>
        {children}
        <ToastContainer />
      </ToastStateContext.Provider>
    </ToastApiContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastApiContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

function ToastContainer() {
  const toasts = useContext(ToastStateContext);
  const api = useContext(ToastApiContext);
  if (!toasts || toasts.length === 0) return null;

  const iconMap = {
    success: (
      <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    ),
    error: (
      <svg className="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    ),
    warning: (
      <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
    ),
    info: (
      <svg className="w-5 h-5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    )
  };

  const bgMap = {
    success: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
    error: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800',
    warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    info: 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800'
  };

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg shadow-black/5 dark:shadow-black/20 backdrop-blur-sm min-w-[280px] max-w-md animate-[slideIn_0.2s_ease-out] ${bgMap[toast.type]}`}
          role="alert"
        >
          <div className="shrink-0 mt-0.5">{iconMap[toast.type]}</div>
          <div className="flex-1 text-sm text-slate-800 dark:text-slate-100 leading-snug">{toast.message}</div>
          <button
            type="button"
            onClick={() => api.removeToast(toast.id)}
            className="shrink-0 -mr-1 -mt-1 rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            aria-label="Cerrar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      ))}
    </div>
  );
}
