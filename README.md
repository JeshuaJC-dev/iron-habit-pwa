# HábitoTracker — Strength & Daily Habits PWA

Aplicación full-stack (PWA + app móvil Expo) diseñada para el seguimiento de entrenamiento de fuerza (hipertrofia/RIR, cálculo automático de 1RM estimado, PRs y mapa muscular interactivo) junto con métricas diarias de hábitos, sueño, nutrición y peso corporal.

Construida con estética **OLED Dark / Apple Pro**, enfoque *offline-first* y notificaciones **Web Push reales en iOS** incluso con la pantalla bloqueada.

---

## Características principales

- **Registro de entrenamiento con UX estilo iOS:** rueda numérica dual tipo Cupertino (`NumberWheelPicker`), calculadora rápida de discos, registro de peso/reps/RIR y detección automática de récords personales (e1RM mediante fórmula de Epley).
- **Mapa muscular interactivo:** visualización anatómica SVG en tiempo real del volumen y grupos musculares trabajados por sesión.
- **Temporizador de descanso sin interrumpir música:**
  - Notificaciones **Web Push reales (VAPID / APNs)** disparadas desde el backend para avisar con la pantalla bloqueada en iPhone PWA.
  - Uso de `navigator.audioSession.type = 'ambient'` y `AudioContext` efímero para emitir pitidos sin pausar Spotify ni Apple Music.
- **Analítica e historial:** curvas interactivas de volumen semanal, evolución de peso corporal, adherencia de hábitos y sesiones desplegables in-place.
- **Persistencia híbrida Cloud + Local:**
  - **Producción:** PostgreSQL (Supabase / Neon) con transacciones ACID y cola de escritura serializada para evitar *race conditions*.
  - **Local:** fallback automático a JSON con escritura atómica (`tmp` + `rename`).
  - **Modo Demo (`DEMO_MODE=true`):** carga un dataset de ejemplo en memoria sin requerir contraseña ni modificar disco/BD.
- **Seguridad *fail-closed*:** autenticación con cookies `HttpOnly` firmadas (HMAC-SHA256 + `timingSafeEqual`), Bearer token para sincronización, cabeceras `Helmet` con CSP estricta, CORS validado y `express-rate-limit`.
- **Exportación a Obsidian:** genera automáticamente notas Markdown con frontmatter YAML y tablas de levantamientos/hábitos en tu bóveda local.
- **Cliente móvil nativo (`mobile/`):** versión en React Native / Expo con picker nativo y sincronización opcional con la API.

---

## Stack tecnológico

| Capa | Tecnologías |
| --- | --- |
| **Frontend Web (PWA)** | React 19, Vite, Tailwind CSS, Lucide Icons, Service Worker + Web App Manifest |
| **Backend & API** | Node.js, Express, `helmet`, `cors`, `express-rate-limit`, `compression`, `web-push` |
| **Base de datos** | PostgreSQL (`pg` / Supabase / Neon) + adaptador local JSON atómico + modo Demo en memoria |
| **Móvil (opcional)** | React Native, Expo (`mobile/`) |

---

## Arquitectura del proyecto

```text
├── server.js                 # API REST, seguridad (Auth/CORS/CSP/RateLimit), Web Push y static serving
├── db/
│   └── store.js              # StorageAdapter (PostgreSQL / JSON atómico / Demo en memoria)
├── src/
│   ├── App.jsx               # Estado principal, sincronización y navegación
│   ├── components/           # WorkoutView, HistoryView, PlanView, ProfileView, RestTimer, MuscleVisualizer...
│   └── utils/                # Utilidades de fecha y preferencias
├── public/
│   ├── sw.js                 # Service Worker (PWA + recepción de Web Push)
│   └── manifest.json         # Configuración PWA instalable en iOS/Android
├── data/
│   ├── routine.json          # Plantilla de rutina semanal, movilidad y guía RIR
│   └── db.demo.json          # Dataset de ejemplo para DEMO_MODE
├── export-obsidian.js        # Script CLI para exportar sesiones a Markdown (Obsidian)
└── mobile/                   # App móvil React Native / Expo
```

---

## Arranque rápido en local

### 1. Instalar dependencias y compilar el frontend
```bash
npm install
npm run build
```

### 2. Probar al instante en Modo Demo (con datos de ejemplo)
No requiere configurar base de datos ni contraseña:
```bash
npm run demo
```
Abre `http://localhost:3333` en tu navegador. Todos los cambios se mantienen en memoria y se reinician limpiamente al reiniciar el servidor.

### 3. Modo personal / producción
Copia [.env.example](.env.example) a `.env` y configura tus variables:
```bash
cp .env.example .env
```

Variables principales:
- `APP_PASSWORD`: contraseña maestra (obligatoria en producción si `DEMO_MODE=false`).
- `DATABASE_URL`: cadena de conexión PostgreSQL (opcional; si se omite, usa `data/db.json` local).
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`: claves generadas con `npx web-push generate-vapid-keys` para notificaciones Web Push en iOS.
- `OBSIDIAN_VAULT_PATH`: ruta local opcional para exportar sesiones en Markdown.

Arranca el servidor:
```bash
npm start
```

Para desarrollo con recarga en caliente (Vite + API):
```bash
npm run server   # Terminal 1 (API en :3333)
npm run dev      # Terminal 2 (Vite en :5173)
```

---

## Despliegue en Render (Producción o Demo pública)

- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`
- **Variables recomendadas:**
  - Para **uso personal**: `NODE_ENV=production`, `APP_PASSWORD`, `DATABASE_URL`, `VAPID_*`.
  - Para **demo de portfolio**: `NODE_ENV=production`, `DEMO_MODE=true`.

---

## Licencia

MIT
