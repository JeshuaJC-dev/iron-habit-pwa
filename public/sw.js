const CACHE_NAME = 'thragg-pwa-v3';
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon.svg'
];

let activeTimerTimeout = null;
let activeTimerResolve = null;
let lastNotifiedEndTime = 0;

function clearActiveTimer() {
  if (activeTimerTimeout) {
    clearTimeout(activeTimerTimeout);
    activeTimerTimeout = null;
  }
  if (activeTimerResolve) {
    activeTimerResolve();
    activeTimerResolve = null;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Nunca cachear llamadas a la API (la app gestiona su propio fallback offline con localStorage)
  if (url.pathname.startsWith('/api/')) return;

  // Navegación HTML: Network-First con fallback a caché para abrir offline en el gimnasio
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match('/').then((cached) => cached || caches.match(request)))
    );
    return;
  }

  // Assets estáticos (/assets/*, iconos, CSS, JS): Cache-First con actualización desde red si no existe
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});

function triggerRestNotification(title, body, tag = 'rest-timer-finish') {
  return self.registration.showNotification(title || '¡Descanso completado! 🔔', {
    body: body || 'Tu tiempo de recuperación ha terminado. ¡A por la siguiente serie!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag,
    vibrate: [300, 150, 300, 150, 500],
    renotify: true,
    requireInteraction: true,
    silent: false
  });
}

self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'START_TIMER' || event.data.type === 'KEEP_ALIVE_PING') {
    clearActiveTimer();

    const { endTime, title, body } = event.data;
    if (!endTime) return;
    const delay = Math.max(0, endTime - Date.now());

    const timerPromise = new Promise((resolve) => {
      activeTimerResolve = resolve;
      activeTimerTimeout = setTimeout(() => {
        activeTimerTimeout = null;
        activeTimerResolve = null;
        if (Math.abs(lastNotifiedEndTime - endTime) < 1500) {
          resolve();
          return;
        }
        lastNotifiedEndTime = endTime;
        triggerRestNotification(title, body).finally(resolve);
      }, delay);
    });

    event.waitUntil(timerPromise);
  }

  if (event.data.type === 'CANCEL_TIMER') {
    clearActiveTimer();
  }

  if (event.data.type === 'SHOW_NOTIFICATION') {
    clearActiveTimer();
    const { title, body, tag, endTime } = event.data;
    if (endTime && Math.abs(lastNotifiedEndTime - endTime) < 1500) {
      return;
    }
    if (endTime) lastNotifiedEndTime = endTime;
    event.waitUntil(triggerRestNotification(title, body, tag));
  }
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const { title, body, tag, endTime } = payload;
  // Evitar duplicado si la app ya mostró el aviso local en pantalla
  if (endTime && Math.abs(lastNotifiedEndTime - endTime) < 4000) {
    return;
  }
  if (endTime) lastNotifiedEndTime = endTime;
  clearActiveTimer();
  event.waitUntil(triggerRestNotification(title, body, tag || 'rest-timer-finish'));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});
