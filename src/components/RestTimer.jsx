import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Timer, Square, Bell, BellOff, Volume2, VolumeX, CheckCircle2, X } from 'lucide-react';
import { triggerSafeVibrate } from '../utils/preferences';

// Ensure iOS / mobile browsers mix audio with Spotify/Apple Music instead of pausing it
function configureAmbientAudioSession() {
  if (typeof navigator === 'undefined') return;
  if ('audioSession' in navigator && navigator.audioSession) {
    try {
      navigator.audioSession.type = 'ambient';
    } catch (e) {}
  }
  // Release any MediaSession ownership so Spotify keeps the lock-screen player
  if ('mediaSession' in navigator && navigator.mediaSession) {
    try {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
    } catch (e) {}
  }
}

// Helper to convert base64url VAPID public key to Uint8Array for PushManager
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Subscribe this iPhone/browser to real Web Push (APNs) so lock-screen alerts fire even when locked
async function ensureWebPushSubscription() {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window) ||
    Notification.permission !== 'granted'
  ) {
    return false;
  }
  try {
    const keyRes = await fetch('/api/push/public-key');
    if (!keyRes.ok) return false;
    const { enabled, publicKey } = await keyRes.json();
    if (!enabled || !publicKey) return false;

    const reg = await navigator.serviceWorker.ready;
    if (!reg || !reg.pushManager) return false;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });
    }
    if (!sub) return false;

    const subRes = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON() })
    });
    return subRes.ok;
  } catch {
    return false;
  }
}

function scheduleServerPush(delaySeconds, exName, endTime) {
  fetch('/api/push/schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      delaySeconds,
      endTime,
      title: '¡Descanso completado! 🔔',
      body: exName ? `A por la siguiente serie de ${exName}.` : 'Tu tiempo de recuperación ha terminado.'
    })
  }).catch(() => {});
}

function cancelServerPush() {
  fetch('/api/push/cancel', { method: 'POST' }).catch(() => {});
}

// Helper to reliably message Service Worker even before controller claims page
function postToServiceWorker(message) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(message);
    } else {
      navigator.serviceWorker.ready
        .then((reg) => {
          if (reg && reg.active) {
            reg.active.postMessage(message);
          }
        })
        .catch(() => {});
    }
  } catch (e) {}
}

export default function RestTimer({ initialSeconds = 0, onComplete, exerciseName = '' }) {
  const [remaining, setRemaining] = useState(0);
  const [targetDuration, setTargetDuration] = useState(90);
  const [isActive, setIsActive] = useState(false);
  const [justFinishedBanner, setJustFinishedBanner] = useState(false);
  const [statusHint, setStatusHint] = useState('');
  const [hasNotificationPermission, setHasNotificationPermission] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      const val = localStorage.getItem('thragg_timer_sound');
      return val !== null ? JSON.parse(val) : true;
    } catch {
      return true;
    }
  });

  const endTimeRef = useRef(null);
  const wakeLockRef = useRef(null);
  const lastPingRef = useRef(0);
  const finishBannerTimeoutRef = useRef(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Configure ambient audio session & check Notification support on mount
  useEffect(() => {
    configureAmbientAudioSession();
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const granted = Notification.permission === 'granted';
      setHasNotificationPermission(granted);
      if (granted) {
        ensureWebPushSubscription();
      }
    }
    return () => {
      if (finishBannerTimeoutRef.current) clearTimeout(finishBannerTimeoutRef.current);
    };
  }, []);

  const showTemporaryHint = useCallback((msg) => {
    setStatusHint(msg);
    setTimeout(() => {
      setStatusHint((prev) => (prev === msg ? '' : prev));
    }, 5000);
  }, []);

  const toggleSound = () => {
    configureAmbientAudioSession();
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('thragg_timer_sound', JSON.stringify(next));
      } catch {}
      showTemporaryHint(
        next
          ? '🔊 Sonido ambiental activo (no pausa Spotify)'
          : '🔇 Modo silencioso (solo vibración y notificación)'
      );
      return next;
    });
  };

  // Trigger a single system notification via ServiceWorker (no duplicates)
  const dispatchSystemNotification = useCallback((title, body, tag = 'rest-timer-finish', endTime = 0) => {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    // 1. Prefer Service Worker message (deduplicated by endTime inside sw.js)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      postToServiceWorker({
        type: 'SHOW_NOTIFICATION',
        title,
        body,
        tag,
        endTime
      });
      return;
    }

    // 2. Fallback via serviceWorker.ready if controller isn't active yet
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => {
          if (reg && typeof reg.showNotification === 'function') {
            reg.showNotification(title, {
              body,
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              tag,
              vibrate: [300, 150, 300, 150, 500],
              renotify: true,
              requireInteraction: true,
              silent: false
            }).catch(() => {});
          }
        })
        .catch(() => {});
      return;
    }

    // 3. Desktop fallback only when Service Worker is unavailable
    try {
      const notif = new Notification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag
      });
      notif.onclick = () => {
        window.focus();
        notif.close();
      };
    } catch (err) {}
  }, []);

  // Request Notification permission & send immediate test notification
  const requestNotificationPermission = async () => {
    configureAmbientAudioSession();

    if (typeof window === 'undefined' || !('Notification' in window)) {
      showTemporaryHint('📲 En iPhone: usa Compartir → "Añadir a pantalla de inicio" para activar notificaciones de iOS.');
      return;
    }

    try {
      if (Notification.permission === 'granted') {
        setHasNotificationPermission(true);
        const pushOk = await ensureWebPushSubscription();
        if (pushOk) {
          const testRes = await fetch('/api/push/test', { method: 'POST' }).then((r) => r.json()).catch(() => null);
          if (testRes?.success) {
            showTemporaryHint('🔔 Push real enviado desde Apple APNs');
            return;
          }
        }
        dispatchSystemNotification(
          '¡Avisos activos! 🔔',
          'Así te avisará Thragg Tracker cuando termine tu descanso.',
          'rest-timer-test',
          Date.now()
        );
        showTemporaryHint('🔔 Notificación local de prueba enviada');
        return;
      }

      const permission = await Notification.requestPermission();
      const granted = permission === 'granted';
      setHasNotificationPermission(granted);

      if (granted) {
        const pushOk = await ensureWebPushSubscription();
        dispatchSystemNotification(
          '¡Notificaciones activadas! 🔔',
          'Recibirás un aviso cuando termine cada descanso.',
          'rest-timer-test',
          Date.now()
        );
        showTemporaryHint(
          pushOk
            ? '🔔 Push iPhone activado (avisa incluso bloqueado)'
            : '🔔 Avisos del sistema activados'
        );
      } else {
        showTemporaryHint('⚠️ Permiso denegado en ajustes del navegador');
      }
    } catch (err) {
      console.warn('Notification permission error:', err);
    }
  };

  // Screen WakeLock to keep screen on while resting so it does not auto-lock
  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator && !wakeLockRef.current && document.visibilityState === 'visible') {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        wakeLockRef.current.addEventListener('release', () => {
          wakeLockRef.current = null;
        });
      }
    } catch (err) {}
  }, []);

  const releaseWakeLock = useCallback(async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch (err) {}
  }, []);

  // Post timer events to Service Worker so lockscreen notifications fire even if phone is sleeping
  const notifyServiceWorkerStart = useCallback((endTime, exName, isPing = false) => {
    postToServiceWorker({
      type: isPing ? 'KEEP_ALIVE_PING' : 'START_TIMER',
      endTime,
      title: '¡Descanso completado! 🔔',
      body: exName ? `A por la siguiente serie de ${exName}.` : 'Tu tiempo de recuperación ha terminado.'
    });
  }, []);

  const notifyServiceWorkerCancel = useCallback(() => {
    postToServiceWorker({
      type: 'CANCEL_TIMER'
    });
  }, []);

  // Non-intrusive sound alert that mixes with Spotify and immediately closes AudioContext
  const playAlertSound = useCallback(() => {
    // Respect user haptic preference on mobile
    triggerSafeVibrate([300, 150, 300, 150, 500]);

    if (!soundEnabled) return;

    try {
      configureAmbientAudioSession();
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      // Create a transient context and close it right after the 0.55s chime
      // so the browser immediately releases audio hardware back to Spotify
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      [0, 0.16, 0.32].forEach((delay, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const freqs = [880, 1174, 1760]; // A5, D6, A6
        osc.frequency.setValueAtTime(freqs[idx], ctx.currentTime + delay);

        gain.gain.setValueAtTime(0.2, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.25);
      });

      setTimeout(() => {
        try {
          ctx.close().catch(() => {});
        } catch (e) {}
      }, 650);
    } catch (e) {
      console.warn('Audio alert error:', e);
    }
  }, [soundEnabled]);

  const finishTimer = useCallback(() => {
    const finishedEndTime = endTimeRef.current || Date.now();
    setIsActive(false);
    setRemaining(0);
    endTimeRef.current = null;
    releaseWakeLock();
    document.title = '¡A entrenar! · Thragg Tracker';

    // Show high-visibility in-app banner
    setJustFinishedBanner(true);
    if (finishBannerTimeoutRef.current) clearTimeout(finishBannerTimeoutRef.current);
    finishBannerTimeoutRef.current = setTimeout(() => {
      setJustFinishedBanner(false);
    }, 6500);

    playAlertSound();

    const title = '¡Descanso completado! 🔔';
    const body = exerciseName ? `A por la siguiente serie de ${exerciseName}.` : 'Tu tiempo de recuperación ha terminado.';
    dispatchSystemNotification(title, body, 'rest-timer-finish', finishedEndTime);

    if (onCompleteRef.current) onCompleteRef.current();
  }, [playAlertSound, releaseWakeLock, dispatchSystemNotification, exerciseName]);

  // Start or reset timer
  const startTimer = useCallback((seconds) => {
    configureAmbientAudioSession();

    const duration = Math.max(5, seconds);
    const endTime = Date.now() + duration * 1000;
    setJustFinishedBanner(false);
    setTargetDuration(duration);
    endTimeRef.current = endTime;
    lastPingRef.current = Date.now();
    setRemaining(duration);
    setIsActive(true);
    requestWakeLock();

    // Schedule background alert on Service Worker + real server Web Push (iPhone lock screen)
    notifyServiceWorkerStart(endTime, exerciseName, false);
    scheduleServerPush(duration, exerciseName, endTime);

    // Request notifications if still in default state
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        setHasNotificationPermission(true);
      } else if (Notification.permission === 'default') {
        Notification.requestPermission()
          .then((perm) => {
            setHasNotificationPermission(perm === 'granted');
          })
          .catch(() => {});
      }
    }
  }, [requestWakeLock, notifyServiceWorkerStart, exerciseName]);

  const stopTimer = useCallback(() => {
    setIsActive(false);
    setRemaining(0);
    endTimeRef.current = null;
    releaseWakeLock();
    notifyServiceWorkerCancel();
    cancelServerPush();
    document.title = 'Thragg Tracker';
  }, [releaseWakeLock, notifyServiceWorkerCancel]);

  const adjustTimer = useCallback((deltaSec) => {
    if (!endTimeRef.current) return;
    const nextEnd = Math.max(Date.now() + 5000, endTimeRef.current + deltaSec * 1000);
    endTimeRef.current = nextEnd;
    const secsLeft = Math.max(0, Math.ceil((nextEnd - Date.now()) / 1000));
    setRemaining(secsLeft);
    notifyServiceWorkerStart(nextEnd, exerciseName, false);
    scheduleServerPush(secsLeft, exerciseName, nextEnd);
  }, [notifyServiceWorkerStart, exerciseName]);

  // Listen to prop changes from ExerciseCard check buttons (supports number or { seconds, ts })
  useEffect(() => {
    const secs = typeof initialSeconds === 'object' && initialSeconds !== null
      ? initialSeconds.seconds
      : initialSeconds;
    if (secs && secs > 0) {
      startTimer(secs);
    }
  }, [initialSeconds, startTimer]);

  // Re-acquire wakeLock and catch-up on visibilitychange (e.g. user toggles screen or switches app)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        configureAmbientAudioSession();
        if (typeof window !== 'undefined' && 'Notification' in window) {
          setHasNotificationPermission(Notification.permission === 'granted');
        }
        if (isActive && endTimeRef.current) {
          requestWakeLock();
          const now = Date.now();
          if (now >= endTimeRef.current) {
            finishTimer();
          } else {
            setRemaining(Math.ceil((endTimeRef.current - now) / 1000));
            notifyServiceWorkerStart(endTimeRef.current, exerciseName, true);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isActive, requestWakeLock, finishTimer, notifyServiceWorkerStart, exerciseName]);

  // Accurate drift-free ticker + Service Worker keep-alive ping every 15s
  useEffect(() => {
    if (!isActive || !endTimeRef.current) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const diffMs = endTimeRef.current - now;
      const secsLeft = Math.max(0, Math.ceil(diffMs / 1000));

      setRemaining(secsLeft);

      // Keep Service Worker awake every 15 seconds while counting down
      if (secsLeft > 2 && now - lastPingRef.current >= 15000) {
        lastPingRef.current = now;
        notifyServiceWorkerStart(endTimeRef.current, exerciseName, true);
      }

      // Update browser tab title
      const m = Math.floor(secsLeft / 60);
      const s = secsLeft % 60;
      const formatted = `${m}:${s.toString().padStart(2, '0')}`;
      document.title = `(${formatted}) Descanso · Thragg`;

      if (secsLeft <= 0) {
        clearInterval(interval);
        finishTimer();
      }
    }, 250);

    return () => clearInterval(interval);
  }, [isActive, finishTimer, notifyServiceWorkerStart, exerciseName]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const timeFormatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  const progressPercent = targetDuration > 0
    ? Math.min(100, Math.max(0, ((targetDuration - remaining) / targetDuration) * 100))
    : 0;

  return (
    <>
      {/* Floating Dynamic Island - when timer is counting down */}
      {isActive && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-40 pointer-events-none transition-all duration-300 animate-in fade-in slide-in-from-top-2"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 3.25rem)' }}
        >
          <div className="pointer-events-auto flex items-center gap-2 sm:gap-3 px-3.5 py-1.5 rounded-full bg-[#0d0d12]/95 backdrop-blur-2xl border border-viltrum-crimson/50 shadow-xl shadow-rose-950/80">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-viltrum-crimson animate-ping" />
              <span className="font-mono text-xs sm:text-sm font-bold text-white tracking-tight">
                {timeFormatted}
              </span>
            </div>

            <div className="h-3 w-px bg-white/20" />

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => adjustTimer(-15)}
                className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-white/10 hover:bg-white/20 text-apple-textSecondary hover:text-white transition active:scale-90 cursor-pointer"
                title="-15 segundos"
              >
                -15s
              </button>
              <button
                type="button"
                onClick={() => adjustTimer(15)}
                className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-white/10 hover:bg-white/20 text-apple-textSecondary hover:text-white transition active:scale-90 cursor-pointer"
                title="+15 segundos"
              >
                +15s
              </button>
              <button
                type="button"
                onClick={stopTimer}
                className="p-1 rounded-full bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition active:scale-90 cursor-pointer"
                title="Detener cronómetro"
              >
                <Square className="w-2.5 h-2.5 fill-current" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Finish Alert Banner - when timer reaches 00:00 */}
      {justFinishedBanner && !isActive && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-sm pointer-events-none transition-all duration-300 animate-in fade-in slide-in-from-top-3"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
        >
          <div className="pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-emerald-950/95 backdrop-blur-2xl border border-emerald-400/50 shadow-2xl shadow-emerald-950/90">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 animate-bounce">
                <CheckCircle2 className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <span className="text-xs font-mono font-black uppercase tracking-wider text-emerald-300 block">
                  ¡Descanso completado! 🔔
                </span>
                <span className="text-[11px] text-white font-medium truncate block">
                  {exerciseName ? `A por la siguiente serie de ${exerciseName}` : 'Tiempo de recuperación finalizado'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setJustFinishedBanner(false)}
              className="p-1.5 rounded-full bg-white/10 text-zinc-300 hover:text-white transition cursor-pointer shrink-0"
              aria-label="Cerrar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main In-Flow Rest Card */}
      <div className="w-full">
        <div
          className={`rounded-3xl transition-all duration-300 backdrop-blur-2xl border shadow-xl p-3.5 sm:p-4 ${
            isActive
              ? 'bg-[#0f0f14]/95 border-viltrum-crimson/40 shadow-rose-950/70'
              : 'bg-[#121216]/80 border-transparent'
          }`}
        >
          {/* Main Controls Row */}
          <div className="flex items-center justify-between gap-3">
            {/* Left: Animated Icon + Digits */}
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all shrink-0 ${
                  isActive
                    ? 'bg-viltrum-crimson text-white shadow-lg shadow-rose-600/50 scale-105'
                    : 'bg-white/[0.06] text-apple-textSecondary'
                }`}
              >
                <Timer className={`w-4 h-4 sm:w-5 sm:h-5 ${isActive ? 'animate-pulse' : ''}`} />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-apple-textTertiary font-semibold block">
                    {isActive ? 'Descanso Activo' : 'Cronómetro de Descanso'}
                  </span>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-viltrum-crimson animate-ping" />
                  )}
                </div>

                <div className="font-mono text-xl sm:text-3xl font-extrabold tracking-tight text-white flex items-baseline gap-2">
                  <span className={isActive ? 'text-white drop-shadow-[0_0_12px_rgba(225,29,72,0.8)]' : 'text-apple-textSecondary'}>
                    {timeFormatted}
                  </span>
                  {isActive && (
                    <span className="text-[11px] font-sans font-normal text-apple-textTertiary">
                      / {Math.floor(targetDuration / 60)}m {targetDuration % 60 ? `${targetDuration % 60}s` : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Quick Durations & Adjust Actions */}
            <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-end">
              {isActive ? (
                <>
                  <button
                    type="button"
                    onClick={() => adjustTimer(-15)}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-apple-textSecondary hover:text-white flex items-center justify-center text-[11px] sm:text-xs font-mono transition active:scale-90 cursor-pointer"
                    title="-15 segundos"
                  >
                    -15s
                  </button>
                  <button
                    type="button"
                    onClick={() => adjustTimer(15)}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-apple-textSecondary hover:text-white flex items-center justify-center text-[11px] sm:text-xs font-mono transition active:scale-90 cursor-pointer"
                    title="+15 segundos"
                  >
                    +15s
                  </button>
                  <button
                    type="button"
                    onClick={stopTimer}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30 flex items-center justify-center transition active:scale-90 cursor-pointer"
                    title="Detener cronómetro"
                  >
                    <Square className="w-3 h-3 fill-current" />
                  </button>
                </>
              ) : (
                <>
                  {[60, 90, 120, 180].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => startTimer(s)}
                      className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-mono font-semibold bg-white/[0.05] hover:bg-viltrum-crimson hover:text-white text-apple-textSecondary border border-transparent transition active:scale-95 cursor-pointer"
                    >
                      {s < 120 ? `${s}s` : `${s / 60}m`}
                    </button>
                  ))}
                </>
              )}

              {/* Sound Toggle Button */}
              <button
                type="button"
                onClick={toggleSound}
                className={`p-1.5 sm:p-2 rounded-full border transition active:scale-90 cursor-pointer ${
                  soundEnabled
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : 'bg-white/[0.04] text-zinc-500 hover:text-white border-transparent'
                }`}
                title={soundEnabled ? 'Sonido ambiental activo (no pausa Spotify)' : 'Silenciado (solo vibración)'}
                aria-label={soundEnabled ? 'Sonido activado' : 'Silenciado'}
              >
                {soundEnabled ? (
                  <Volume2 className="w-3.5 h-3.5" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5" />
                )}
              </button>

              {/* Notification Permission & Test Bell button */}
              <button
                type="button"
                onClick={requestNotificationPermission}
                className={`p-1.5 sm:p-2 rounded-full border transition active:scale-90 cursor-pointer ${
                  hasNotificationPermission
                    ? 'bg-apple-green/10 text-apple-green border-apple-green/30'
                    : 'bg-white/[0.04] text-apple-textTertiary hover:text-white border-transparent'
                }`}
                title={
                  hasNotificationPermission
                    ? 'Avisos activos (toca para probar notificación)'
                    : 'Toca para activar notificaciones en el móvil'
                }
                aria-label="Activar o probar notificaciones"
              >
                {hasNotificationPermission ? (
                  <Bell className="w-3.5 h-3.5" />
                ) : (
                  <BellOff className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Thin Progress Line */}
          {isActive && (
            <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden mt-3">
              <div
                className="h-full bg-gradient-to-r from-viltrum-crimson to-amber-400 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}

          {/* Status Hint or Wake Lock Strip */}
          {(isActive || statusHint) && (
            <div className="mt-2.5 pt-2 border-t border-white/[0.04] flex items-center justify-between text-[10px] font-mono text-zinc-400">
              {statusHint ? (
                <span className="text-amber-300 font-semibold truncate">{statusHint}</span>
              ) : (
                <>
                  <span className="flex items-center gap-1.5 text-zinc-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Spotify compatible · Pantalla activa
                  </span>
                  <button
                    type="button"
                    onClick={requestNotificationPermission}
                    className="text-zinc-400 hover:text-white underline decoration-zinc-600 cursor-pointer"
                  >
                    {hasNotificationPermission ? '🔔 Avisos listos' : '⚠️ Activar 🔔'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
