import React, { useState, useEffect } from 'react';
import { Lock, ShieldAlert, ArrowRight, Eye, EyeOff } from 'lucide-react';

const AUTH_CACHE_KEY = 'thragg_auth_ok';

export default function AuthGate({ children }) {
  const [status, setStatus] = useState('checking'); // 'checking' | 'authenticated' | 'locked' | 'misconfigured'
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    fetch('/api/auth/status', { credentials: 'same-origin' })
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data?.misconfigured) {
          setStatus('misconfigured');
        } else if (data?.authenticated || !data?.authRequired) {
          try {
            localStorage.setItem(AUTH_CACHE_KEY, '1');
          } catch {}
          setStatus('authenticated');
        } else {
          try {
            localStorage.removeItem(AUTH_CACHE_KEY);
          } catch {}
          setStatus('locked');
        }
      })
      .catch(() => {
        if (!active) return;
        // Si estamos offline en el gimnasio pero ya nos autenticamos antes, permitimos modo offline
        let hadAuth = false;
        try {
          hadAuth = localStorage.getItem(AUTH_CACHE_KEY) === '1';
        } catch {}
        setStatus(hadAuth ? 'authenticated' : 'locked');
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim() || submitting) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ password: password.trim() })
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        try {
          localStorage.setItem(AUTH_CACHE_KEY, '1');
        } catch {}
        setPassword('');
        setStatus('authenticated');
      } else {
        setError(data.error || 'Clave incorrecta');
      }
    } catch {
      setError('Sin conexión con el servidor. Inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'authenticated') {
    return children;
  }

  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 select-none">
        <div className="w-10 h-10 border-2 border-viltrum-crimson border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-mono text-zinc-500">Verificando sesión...</p>
      </div>
    );
  }

  if (status === 'misconfigured') {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-full max-w-sm p-6 rounded-3xl bg-[#121217] border border-amber-500/30 space-y-3">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-extrabold text-white">Falta configurar APP_PASSWORD</h1>
          <p className="text-xs text-zinc-400 leading-relaxed">
            El servidor en producción ha bloqueado el acceso por seguridad porque aún no tiene configurada la variable de entorno <code className="text-amber-300 font-mono">APP_PASSWORD</code> en Render.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 select-none">
      <div className="w-full max-w-sm p-6 rounded-3xl bg-[#121217] border border-white/10 shadow-2xl space-y-5">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-viltrum-crimson/15 border border-viltrum-crimson/35 flex items-center justify-center text-viltrum-crimson shadow-lg shadow-rose-950/60">
            <Lock className="w-7 h-7" />
          </div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-viltrum-crimson font-bold block">
            THRAGG TRACKER · ACCESO PRIVADO
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            Desbloquear Bóveda
          </h1>
          <p className="text-xs text-zinc-400">
            Introduce tu clave maestra. Tu iPhone recordará la sesión durante 90 días.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            name="username"
            autoComplete="username"
            defaultValue="thragg"
            className="hidden"
            readOnly
            tabIndex={-1}
            aria-hidden="true"
          />

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Clave de acceso"
              className="w-full h-12 rounded-2xl bg-black/70 border border-white/15 focus:border-viltrum-crimson px-4 pr-11 text-base text-white font-mono outline-none transition"
              autoFocus
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1"
              aria-label={showPassword ? 'Ocultar clave' : 'Mostrar clave'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {error && (
            <p className="text-xs font-mono text-rose-400 text-center bg-rose-500/10 border border-rose-500/25 rounded-xl py-2 px-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !password.trim()}
            className="w-full h-12 rounded-2xl bg-viltrum-crimson hover:bg-rose-600 active:scale-[0.98] disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-rose-950/60"
          >
            <span>{submitting ? 'Verificando...' : 'Entrar'}</span>
            {!submitting && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
