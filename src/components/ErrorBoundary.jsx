import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Render crash:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100 p-8">
          <div className="max-w-md space-y-4 text-center">
            <p className="text-4xl">⚠️</p>
            <h1 className="text-xl font-semibold">Algo salió mal</h1>
            <p className="text-sm text-slate-400">{this.state.error?.message ?? 'Error desconocido'}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium hover:bg-sky-500"
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
