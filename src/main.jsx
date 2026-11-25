import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import AuthGate from './components/AuthGate.jsx';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Crash caught by ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center select-none font-sans">
          <div className="w-14 h-14 rounded-3xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 mb-4 text-2xl font-black">
            !
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Se ha producido un error inesperado</h2>
          <p className="text-xs font-mono text-zinc-400 max-w-sm mb-6 leading-relaxed">
            {this.state.error?.message || 'Error de renderizado en la interfaz.'}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                if (window.confirm('¿Restablecer solo preferencias visuales? Tus entrenamientos guardados NO se borrarán.')) {
                  localStorage.removeItem('habito_athlete_profile');
                  window.location.reload();
                }
              }}
              className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-xs font-mono text-zinc-300 font-bold transition"
            >
              Restablecer UI
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2.5 rounded-2xl bg-viltrum-crimson hover:bg-rose-600 text-xs font-mono text-white font-bold transition shadow-lg shadow-rose-950/60"
            >
              Recargar app
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthGate>
        <App />
      </AuthGate>
    </ErrorBoundary>
  </React.StrictMode>
);

// Register Service Worker for notifications and offline support
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        try {
          reg.update();
        } catch (e) {}
      })
      .catch((err) => {
        console.warn('ServiceWorker registration error:', err);
      });
  });
}

