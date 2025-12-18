import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { AuthProvider } from './context/AuthContext';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <App />
    </AuthProvider>
  </QueryClientProvider>
);

if (typeof window !== 'undefined' && !window.__suppressResizeObserverError) {
  const resizeObserverRegex = /ResizeObserver loop (limit exceeded|completed with undelivered notifications)/;

  const suppressResizeObserverEvent = (event) => {
    const message =
      event?.message ||
      event?.error?.message ||
      event?.reason?.message ||
      (typeof event?.reason === 'string' ? event.reason : '') ||
      '';
    if (resizeObserverRegex.test(message)) {
      if (typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
      event.stopImmediatePropagation();
    }
  };

  window.addEventListener('error', suppressResizeObserverEvent);
  window.addEventListener('unhandledrejection', suppressResizeObserverEvent);

  const originalConsoleError = window.console.error;
  window.console.error = (...args) => {
    if (
      args.some((arg) => {
        if (typeof arg === 'string') {
          return resizeObserverRegex.test(arg);
        }
        if (arg instanceof Error && resizeObserverRegex.test(arg.message)) {
          return true;
        }
        return false;
      })
    ) {
      return;
    }
    originalConsoleError(...args);
  };

  window.__suppressResizeObserverError = true;
}
reportWebVitals();
