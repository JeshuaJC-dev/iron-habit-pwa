require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const webpush = require('web-push');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { StorageAdapter } = require('./db/store');

const app = express();
const PORT = process.env.PORT || 3333;
const DEMO_MODE = process.env.DEMO_MODE === 'true';
const IS_PROD = process.env.RENDER === 'true' || process.env.NODE_ENV === 'production';
const APP_PASSWORD = (process.env.APP_PASSWORD || '').trim();
const AUTH_COOKIE_NAME = 'thragg_session';
const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 días

const DATA_DIR = path.join(__dirname, 'data');
const ROUTINE_FILE = path.join(DATA_DIR, 'routine.json');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const staticDir = fs.existsSync(path.join(__dirname, 'dist'))
  ? path.join(__dirname, 'dist')
  : path.join(__dirname, 'public');

// Confiar en el proxy inverso (Render) para IP real y HTTPS (req.secure)
app.set('trust proxy', 1);

// =========================================================================
// SEGURIDAD: CABECERAS HTTP, CORS ESTRICTO Y RATE LIMITING
// =========================================================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'data:'],
      manifestSrc: ["'self'"],
      workerSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

const envOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

if (process.env.RENDER_EXTERNAL_URL) {
  envOrigins.push(process.env.RENDER_EXTERNAL_URL.trim().replace(/\/+$/, ''));
}

const allowedOrigins = new Set([
  ...envOrigins,
  ...(!IS_PROD ? [
    `http://localhost:${PORT}`,
    `http://127.0.0.1:${PORT}`,
    'http://localhost:5173',
    'http://127.0.0.1:5173'
  ] : [])
]);

app.use(cors((req, callback) => {
  const origin = req.headers.origin;
  if (!origin) return callback(null, { origin: true, credentials: true });

  // Permitir siempre el mismo origen (incluye <script crossorigin> de Vite, POST same-origin y Wi-Fi local)
  const host = req.get('host');
  const proto = req.headers['x-forwarded-proto']?.split(',')[0]?.trim() || req.protocol;
  const selfOrigin = host ? `${proto}://${host}` : '';

  if (origin === selfOrigin || allowedOrigins.has(origin)) {
    return callback(null, { origin: true, credentials: true });
  }

  return callback(new Error('Origen no permitido por CORS'));
}));

app.use(compression());
app.use(express.json({ limit: '1mb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Espera un momento.' }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos fallidos. Espera 15 minutos.' }
});

app.use('/api', apiLimiter);

// =========================================================================
// SEGURIDAD: AUTENTICACIÓN (COOKIE FIRMADA HttpOnly + BEARER TOKEN)
// =========================================================================
function getSigningKey() {
  return crypto
    .createHash('sha256')
    .update(`thragg-session-v1:${APP_PASSWORD}`)
    .digest();
}

function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function createSessionToken() {
  const expiresAt = String(Date.now() + SESSION_TTL_MS);
  const sig = crypto
    .createHmac('sha256', getSigningKey())
    .update(expiresAt)
    .digest('base64url');
  return `${expiresAt}.${sig}`;
}

function verifySessionToken(token) {
  if (!APP_PASSWORD || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [expiresAtStr, sig] = parts;
  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;

  const expectedSig = crypto
    .createHmac('sha256', getSigningKey())
    .update(expiresAtStr)
    .digest('base64url');

  return safeCompare(sig, expectedSig);
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const cookies = Object.create(null);
  if (!header || typeof header !== 'string') return cookies;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key && key !== '__proto__' && key !== 'constructor' && key !== 'prototype') {
      try {
        cookies[key] = decodeURIComponent(val);
      } catch {
        cookies[key] = val;
      }
    }
  }
  return cookies;
}

function isRequestAuthenticated(req) {
  if (DEMO_MODE) return true;
  if (!APP_PASSWORD) {
    // En producción (Render) fallamos cerrado si falta APP_PASSWORD
    return !IS_PROD;
  }

  // 1. Authorization: Bearer <token> (para sync desde PC local)
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (safeCompare(bearer, APP_PASSWORD)) return true;
  }

  // 2. Cookie HttpOnly firmada (para navegador móvil / PWA)
  const cookies = parseCookies(req);
  if (verifySessionToken(cookies[AUTH_COOKIE_NAME])) return true;

  return false;
}

function requireAuth(req, res, next) {
  if (DEMO_MODE) return next();
  if (IS_PROD && !APP_PASSWORD) {
    return res.status(503).json({
      error: 'Servidor sin APP_PASSWORD configurado en las variables de entorno.'
    });
  }
  if (!isRequestAuthenticated(req)) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  return next();
}

// =========================================================================
// SEGURIDAD: VALIDACIÓN Y SANITIZACIÓN DE ENTRADAS
// =========================================================================
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isValidDateKey(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const [y, m, d] = str.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function isSafeId(str) {
  return typeof str === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(str) && !FORBIDDEN_KEYS.has(str);
}

function clampNum(val, min, max, fallback = 0) {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function cleanStr(val, maxLen = 500) {
  if (typeof val !== 'string') return '';
  return val.slice(0, maxLen);
}

function sanitizeHabit(habit) {
  if (!habit || typeof habit !== 'object' || Array.isArray(habit)) return {};
  const clean = {};
  if (habit.calories !== undefined && habit.calories !== '') clean.calories = Math.round(clampNum(habit.calories, 0, 20000, 0));
  if (habit.protein !== undefined && habit.protein !== '') clean.protein = Math.round(clampNum(habit.protein, 0, 1000, 0));
  if (habit.water !== undefined && habit.water !== '') clean.water = Math.round(clampNum(habit.water, 0, 30, 0) * 100) / 100;
  if (habit.sleepHours !== undefined && habit.sleepHours !== '') clean.sleepHours = Math.round(clampNum(habit.sleepHours, 0, 24, 0) * 10) / 10;
  if (habit.sleepQuality !== undefined && habit.sleepQuality !== '') clean.sleepQuality = Math.round(clampNum(habit.sleepQuality, 0, 10, 0));
  if (habit.wellness !== undefined && habit.wellness !== '') clean.wellness = Math.round(clampNum(habit.wellness, 0, 10, 0));
  if (habit.creatine !== undefined) clean.creatine = Boolean(habit.creatine);
  if (habit.skincareMorning !== undefined) clean.skincareMorning = Boolean(habit.skincareMorning);
  if (habit.skincareNight !== undefined) clean.skincareNight = Boolean(habit.skincareNight);
  if (habit.mobilityMorning !== undefined) clean.mobilityMorning = Boolean(habit.mobilityMorning);
  if (habit.mobilityNight !== undefined) clean.mobilityNight = Boolean(habit.mobilityNight);
  if (habit.legWarmup !== undefined) clean.legWarmup = Boolean(habit.legWarmup);
  if (habit.alcohol !== undefined) clean.alcohol = Boolean(habit.alcohol);
  if (habit.notes !== undefined) clean.notes = cleanStr(habit.notes, 1000);
  if (typeof habit.updatedAt === 'string') clean.updatedAt = cleanStr(habit.updatedAt, 40);
  return clean;
}

// =========================================================================
// CACHÉ HTTP Y ARCHIVOS ESTÁTICOS
// =========================================================================
app.use((req, res, next) => {
  if (req.path === '/' || req.path === '/index.html' || req.path === '/sw.js') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

app.use(express.static(staticDir, {
  maxAge: '1y',
  immutable: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html') || filePath.endsWith('sw.js') || filePath.endsWith('manifest.json')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    }
  }
}));

// =========================================================================
// BASE DE DATOS (PostgreSQL si existe DATABASE_URL, si no db.json atómico)
// =========================================================================
const store = new StorageAdapter(DATA_DIR);

function readDb() {
  return store.getDb();
}

function writeDb(data) {
  return store.saveDb(data);
}

function getEntryTimestamp(entry) {
  if (!entry || typeof entry !== 'object') return 0;
  const raw = entry.updatedAt || entry.completedAt;
  if (!raw) return 0;
  const ts = Date.parse(raw);
  return Number.isFinite(ts) ? ts : 0;
}

// 1RM estimation formula (Epley): w * (1 + r / 30)
function calculateE1RM(weight, reps) {
  const w = parseFloat(weight) || 0;
  const r = parseInt(reps, 10) || 0;
  if (w <= 0 || r <= 0) return 0;
  if (r === 1) return w;
  return Math.round((w * (1 + r / 30)) * 10) / 10;
}

// =========================================================================
// ENDPOINTS DE SALUD Y AUTENTICACIÓN (PÚBLICOS)
// =========================================================================
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    storage: store.getStorageMode(),
    demoMode: DEMO_MODE
  });
});

app.get('/api/auth/status', (req, res) => {
  res.json({
    authRequired: !DEMO_MODE && (Boolean(APP_PASSWORD) || IS_PROD),
    misconfigured: !DEMO_MODE && IS_PROD && !APP_PASSWORD,
    authenticated: isRequestAuthenticated(req),
    demoMode: DEMO_MODE
  });
});

app.post('/api/auth/login', loginLimiter, (req, res) => {
  if (IS_PROD && !APP_PASSWORD) {
    return res.status(503).json({
      error: 'Configura APP_PASSWORD en las variables de entorno de Render.'
    });
  }
  if (!APP_PASSWORD) {
    return res.json({ success: true });
  }

  const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
  if (!password || !safeCompare(password, APP_PASSWORD)) {
    return res.status(401).json({ error: 'Clave incorrecta' });
  }

  const token = createSessionToken();
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const cookieParts = [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
  ];
  if (isHttps || IS_PROD) cookieParts.push('Secure');

  res.setHeader('Set-Cookie', cookieParts.join('; '));
  return res.json({ success: true });
});

app.post('/api/auth/logout', (req, res) => {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const cookieParts = [
    `${AUTH_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0'
  ];
  if (isHttps || IS_PROD) cookieParts.push('Secure');
  res.setHeader('Set-Cookie', cookieParts.join('; '));
  return res.json({ success: true });
});

// =========================================================================
// ENDPOINTS PROTEGIDOS (/api/*)
// =========================================================================

// GET Routine definition
app.get('/api/routine', requireAuth, (req, res) => {
  try {
    const raw = fs.readFileSync(ROUTINE_FILE, 'utf-8');
    res.json(JSON.parse(raw));
  } catch (err) {
    console.error('Error reading routine.json:', err);
    res.status(500).json({ error: 'No se pudo leer la rutina' });
  }
});

// GET Day data (workout + habit for a specific date YYYY-MM-DD)
app.get('/api/day/:date', requireAuth, (req, res) => {
  const { date } = req.params;
  if (!isValidDateKey(date)) {
    return res.status(400).json({ error: 'Formato de fecha inválido (usa YYYY-MM-DD)' });
  }

  const db = readDb();

  const exerciseHistory = {};
  const workoutDates = Object.keys(db.workouts).sort();
  for (const d of workoutDates) {
    if (d < date) {
      const prevW = db.workouts[d];
      if (prevW && prevW.exercises) {
        for (const [exId, sets] of Object.entries(prevW.exercises)) {
          if (isSafeId(exId)) {
            exerciseHistory[exId] = {
              date: d,
              sets: sets
            };
          }
        }
      }
    }
  }

  res.json({
    date,
    workout: db.workouts[date] || null,
    habit: db.habits[date] || null,
    prs: db.prs || {},
    previousSessions: exerciseHistory
  });
});

// POST Save Workout for a date
app.post('/api/workout', requireAuth, async (req, res, next) => {
  try {
    const { date, dayId, sessionName, exercises, notes } = req.body || {};
    if (!isValidDateKey(date)) {
      return res.status(400).json({ error: 'Fecha obligatoria con formato YYYY-MM-DD' });
    }

    const db = readDb();
    const prs = db.prs || {};
    const newPrsDetected = [];

    const processedExercises = {};
    if (exercises && typeof exercises === 'object' && !Array.isArray(exercises)) {
      for (const [exId, sets] of Object.entries(exercises)) {
        if (!isSafeId(exId) || !Array.isArray(sets)) continue;
        processedExercises[exId] = sets.slice(0, 30).map((s, idx) => {
          const weight = Math.round(clampNum(s?.weight, 0, 1000, 0) * 100) / 100;
          const reps = Math.round(clampNum(s?.reps, 0, 10000, 0));
          const rir = s?.rir !== undefined && s?.rir !== null && s?.rir !== ''
            ? Math.round(clampNum(s.rir, 0, 10, 0))
            : null;
          const e1rm = calculateE1RM(weight, reps);
          const exName = cleanStr(s?.exerciseName, 120) || exId;

          let isPr = false;
          const currentBest = prs[exId];
          if (e1rm > 0) {
            if (!currentBest || e1rm > currentBest.e1rm) {
              isPr = true;
              prs[exId] = {
                weight,
                reps,
                e1rm,
                date,
                exerciseName: exName
              };
              newPrsDetected.push({ exId, name: exName, weight, reps, e1rm });
            }
          }

          return {
            setNum: idx + 1,
            weight,
            reps,
            rir,
            e1rm,
            isPr
          };
        });
      }
    }

    const nowIso = new Date().toISOString();
    db.workouts[date] = {
      date,
      dayId: cleanStr(String(dayId || ''), 20),
      sessionName: cleanStr(sessionName, 120),
      notes: cleanStr(notes, 1000),
      completedAt: nowIso,
      updatedAt: nowIso,
      exercises: processedExercises
    };
    db.prs = prs;

    await writeDb(db);
    res.json({ success: true, workout: db.workouts[date], newPrs: newPrsDetected });
  } catch (err) {
    next(err);
  }
});

// POST Save Habit for a date
app.post('/api/habit', requireAuth, async (req, res, next) => {
  try {
    const { date, habit } = req.body || {};
    if (!isValidDateKey(date)) {
      return res.status(400).json({ error: 'Fecha obligatoria con formato YYYY-MM-DD' });
    }

    const db = readDb();
    const sanitized = sanitizeHabit(habit);
    db.habits[date] = {
      ...sanitized,
      updatedAt: new Date().toISOString()
    };

    await writeDb(db);
    res.json({ success: true, habit: db.habits[date] });
  } catch (err) {
    next(err);
  }
});

// POST Save Bodyweight entry
app.post('/api/bodyweight', requireAuth, async (req, res, next) => {
  try {
    const { date, weight, notes } = req.body || {};
    const parsedWeight = clampNum(weight, 20, 350, NaN);
    if (!isValidDateKey(date) || !Number.isFinite(parsedWeight)) {
      return res.status(400).json({ error: 'Fecha (YYYY-MM-DD) y peso válido (20-350 kg) obligatorios' });
    }

    const db = readDb();
    db.bodyweight = db.bodyweight || [];

    const idx = db.bodyweight.findIndex((b) => b.date === date);
    const entry = {
      date,
      weight: Math.round(parsedWeight * 10) / 10,
      notes: cleanStr(notes, 500)
    };
    if (idx >= 0) {
      db.bodyweight[idx] = entry;
    } else {
      db.bodyweight.push(entry);
    }
    db.bodyweight.sort((a, b) => a.date.localeCompare(b.date));

    await writeDb(db);
    res.json({ success: true, bodyweight: db.bodyweight });
  } catch (err) {
    next(err);
  }
});

// GET Dashboard stats
app.get('/api/dashboard', requireAuth, (req, res) => {
  const db = readDb();
  res.json({
    workouts: db.workouts,
    habits: db.habits,
    bodyweight: db.bodyweight || [],
    prs: db.prs || {}
  });
});

// Helper para sincronizar automáticamente con la nube de Render (solo desde PC local)
async function syncFromRenderCloud() {
  if (IS_PROD || DEMO_MODE) return;
  const renderUrl = (process.env.RENDER_API_URL || '').replace(/\/+$/, '');
  const token = (process.env.RENDER_AUTH_TOKEN || APP_PASSWORD || '').trim();
  if (!renderUrl || !token) return;

  try {
    const res = await fetch(`${renderUrl}/api/backup`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const cloudDb = await res.json();
      const localDb = readDb();
      let changed = false;

      for (const [d, w] of Object.entries(cloudDb.workouts || {})) {
        if (!isValidDateKey(d) || !w || typeof w !== 'object') continue;
        if (!localDb.workouts[d] || (w.completedAt && (!localDb.workouts[d].completedAt || w.completedAt > localDb.workouts[d].completedAt))) {
          localDb.workouts[d] = w;
          changed = true;
        }
      }
      for (const [d, h] of Object.entries(cloudDb.habits || {})) {
        if (!isValidDateKey(d) || !h || typeof h !== 'object') continue;
        if (!localDb.habits[d] || (h.updatedAt && (!localDb.habits[d].updatedAt || h.updatedAt > localDb.habits[d].updatedAt))) {
          localDb.habits[d] = sanitizeHabit(h);
          changed = true;
        }
      }
      if (cloudDb.prs && typeof cloudDb.prs === 'object') {
        for (const [exId, pr] of Object.entries(cloudDb.prs)) {
          if (isSafeId(exId) && pr && typeof pr === 'object') {
            localDb.prs[exId] = pr;
            changed = true;
          }
        }
      }
      if (changed) {
        await writeDb(localDb);
        console.log('🔄 [Render Sync] Datos de la nube descargados y sincronizados en local.');
      }
    }
  } catch {
    // Modo offline o sin internet
  }
}

// POST Export sessions to Obsidian Vault (solo PC local con OBSIDIAN_VAULT_PATH configurado)
app.post('/api/export-obsidian', requireAuth, async (req, res) => {
  try {
    const vaultPath = (process.env.OBSIDIAN_VAULT_PATH || '').trim();
    if (IS_PROD || !vaultPath) {
      return res.status(400).json({
        error: 'Exportación a Obsidian solo disponible en PC local con OBSIDIAN_VAULT_PATH configurado.'
      });
    }

    await syncFromRenderCloud();
    const db = readDb();
    const resolvedVault = path.resolve(vaultPath);
    if (!fs.existsSync(resolvedVault)) {
      fs.mkdirSync(resolvedVault, { recursive: true });
    }

    let exportedCount = 0;
    const workouts = db.workouts || {};
    const habits = db.habits || {};

    for (const [date, w] of Object.entries(workouts)) {
      if (!isValidDateKey(date) || !w || typeof w !== 'object') continue;

      const fileName = `Sesion_${date}.md`;
      const filePath = path.resolve(resolvedVault, fileName);
      if (!filePath.startsWith(resolvedVault + path.sep)) {
        continue;
      }

      const h = habits[date] || {};
      let md = `---\n`;
      md += `aliases: [Sesión ${date}, ${cleanStr(w.sessionName, 120) || 'Entreno'}]\n`;
      md += `tags: [sesion, entrenamiento, registro]\n`;
      md += `fecha: ${date}\n`;
      md += `dia: ${cleanStr(String(w.dayId || ''), 20)}\n`;
      md += `completado_at: ${cleanStr(w.completedAt, 40)}\n`;
      md += `---\n\n`;

      md += `# ${cleanStr(w.sessionName, 120) || 'Sesión de Entrenamiento'} — ${date}\n\n`;
      if (w.notes) {
        md += `> **Notas de la sesión:** ${cleanStr(w.notes, 1000)}\n\n`;
      }

      md += `## Levantamientos y Series\n\n`;
      for (const [exId, sets] of Object.entries(w.exercises || {})) {
        if (!isSafeId(exId) || !Array.isArray(sets)) continue;
        md += `### ${exId.replace(/_/g, ' ').toUpperCase()}\n`;
        md += `| Serie | Peso (kg) | Reps | RIR | 1RM Est. | PR? |\n`;
        md += `|---|---|---|---|---|---|\n`;
        for (const s of sets) {
          const prBadge = s.isPr ? '**PR**' : '—';
          md += `| ${s.setNum} | ${s.weight} kg | ${s.reps} | ${s.rir !== null && s.rir !== undefined ? s.rir : '—'} | ${s.e1rm > 0 ? s.e1rm + ' kg' : '—'} | ${prBadge} |\n`;
        }
        md += `\n`;
      }

      if (Object.keys(h).length > 0) {
        md += `## Hábitos y Métricas Diarias\n\n`;
        md += `- **Calorías:** ${h.calories || '—'} kcal\n`;
        md += `- **Proteínas:** ${h.protein || '—'} g\n`;
        md += `- **Creatina:** ${h.creatine ? 'Sí (5g)' : 'No'}\n`;
        md += `- **Agua:** ${h.water || '—'} L\n`;
        md += `- **Sueño:** ${h.sleepHours || '—'} h (Calidad: ${h.sleepQuality || '—'}/10)\n`;
        md += `- **Skin-Care:** Mañana ${h.skincareMorning ? 'Sí' : 'No'} | Noche ${h.skincareNight ? 'Sí' : 'No'}\n`;
        md += `- **Movilidad Mañana:** ${h.mobilityMorning ? 'Sí' : 'No'} | **Noche:** ${h.mobilityNight ? 'Sí' : 'No'}\n`;
        md += `- **Bienestar General:** ${h.wellness || '—'}/10\n`;
        if (h.alcohol) md += `- **Alcohol:** Sí consumido\n`;
        if (h.notes) md += `- **Notas de hábitos:** ${h.notes}\n`;
        md += `\n`;
      }

      md += `---\n`;
      md += `*Exportado automáticamente desde HábitoTracker*\n`;

      fs.writeFileSync(filePath, md, 'utf-8');
      exportedCount++;
    }

    res.json({ success: true, exportedCount });
  } catch (err) {
    console.error('Error exporting to Obsidian:', err);
    res.status(500).json({ error: 'Error interno al exportar notas a Obsidian' });
  }
});

// =========================================================================
// WEB PUSH (NOTIFICACIONES NATIVAS iOS PWA CON PANTALLA BLOQUEADA)
// =========================================================================
const VAPID_PUBLIC_KEY = (process.env.VAPID_PUBLIC_KEY || '').trim();
const VAPID_PRIVATE_KEY = (process.env.VAPID_PRIVATE_KEY || '').trim();
const VAPID_SUBJECT = (
  process.env.VAPID_SUBJECT ||
  process.env.RENDER_EXTERNAL_URL ||
  'mailto:demo@example.com'
).trim();
const pushConfigured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
let activePushTimer = null;

if (pushConfigured) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  } catch (err) {
    console.warn('⚠️ [WebPush] Claves VAPID inválidas:', err.message);
  }
}

async function sendWebPushToAll(payloadObj) {
  const db = readDb();
  const subs = Array.isArray(db.pushSubscriptions) ? db.pushSubscriptions : [];
  if (subs.length === 0) return { sent: 0, errors: [] };

  const payload = JSON.stringify(payloadObj);
  const expiredEndpoints = new Set();
  const errors = [];
  let sent = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, payload, { TTL: 60, urgency: 'high' });
        sent++;
      } catch (err) {
        console.error('❌ [WebPush] Error enviando notificación:', err?.statusCode, err?.body || err?.message);
        errors.push({ statusCode: err?.statusCode || 0, message: err?.body || err?.message || 'Error' });
        if (err && (err.statusCode === 404 || err.statusCode === 410)) {
          expiredEndpoints.add(sub.endpoint);
        }
      }
    })
  );

  if (expiredEndpoints.size > 0) {
    db.pushSubscriptions = subs.filter((s) => !expiredEndpoints.has(s.endpoint));
    await writeDb(db).catch(() => {});
  }

  return { sent, errors };
}

app.get('/api/push/public-key', requireAuth, (req, res) => {
  res.json({
    enabled: pushConfigured,
    publicKey: pushConfigured ? VAPID_PUBLIC_KEY : null
  });
});

app.post('/api/push/subscribe', requireAuth, async (req, res, next) => {
  try {
    if (!pushConfigured) {
      return res.json({ success: false, enabled: false });
    }
    const sub = req.body?.subscription;
    if (
      !sub ||
      typeof sub.endpoint !== 'string' ||
      !sub.endpoint.startsWith('https://') ||
      !sub.keys ||
      typeof sub.keys.p256dh !== 'string' ||
      typeof sub.keys.auth !== 'string'
    ) {
      return res.status(400).json({ error: 'Suscripción Push inválida' });
    }

    const db = readDb();
    const list = Array.isArray(db.pushSubscriptions) ? db.pushSubscriptions : [];
    const filtered = list.filter((item) => item && item.endpoint !== sub.endpoint);
    filtered.push({
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth
      },
      updatedAt: new Date().toISOString()
    });
    // Mantener las últimas 5 suscripciones (ej. iPhone, iPad, PC)
    db.pushSubscriptions = filtered.slice(-5);
    await writeDb(db);
    return res.json({ success: true, count: db.pushSubscriptions.length });
  } catch (err) {
    next(err);
  }
});

app.post('/api/push/schedule', requireAuth, (req, res) => {
  if (!pushConfigured) {
    return res.json({ success: false, enabled: false });
  }

  const delaySeconds = clampNum(req.body?.delaySeconds, 3, 600, NaN);
  if (!Number.isFinite(delaySeconds)) {
    return res.status(400).json({ error: 'delaySeconds inválido (3-600)' });
  }

  const title = cleanStr(req.body?.title, 100) || '¡Descanso completado! 🔔';
  const body = cleanStr(req.body?.body, 200) || 'Tu tiempo de recuperación ha terminado.';
  const endTime = Number(req.body?.endTime) || (Date.now() + delaySeconds * 1000);

  if (activePushTimer) {
    clearTimeout(activePushTimer);
    activePushTimer = null;
  }

  activePushTimer = setTimeout(async () => {
    activePushTimer = null;
    try {
      await sendWebPushToAll({
        title,
        body,
        tag: 'rest-timer-finish',
        endTime
      });
    } catch (err) {
      console.warn('Error enviando WebPush:', err.message);
    }
  }, Math.round(delaySeconds * 1000));

  return res.json({ success: true, scheduledIn: delaySeconds });
});

app.post('/api/push/test', requireAuth, async (req, res) => {
  if (!pushConfigured) {
    return res.status(400).json({ success: false, error: 'Faltan claves VAPID en Render' });
  }
  const result = await sendWebPushToAll({
    title: '¡Push iPhone operativo! 🔔',
    body: 'Así te avisará Thragg Tracker cuando termine tu descanso (incluso bloqueado).',
    tag: 'rest-timer-test',
    endTime: Date.now()
  });
  return res.json({ success: result.sent > 0, sent: result.sent, errors: result.errors });
});

app.post('/api/push/cancel', requireAuth, (req, res) => {
  if (activePushTimer) {
    clearTimeout(activePushTimer);
    activePushTimer = null;
  }
  return res.json({ success: true });
});

// GET Backup completo de la base de datos (sin exponer pushSubscriptions)
app.get('/api/backup', requireAuth, (req, res) => {
  const db = readDb();
  res.setHeader('Content-Type', 'application/json');
  res.json({
    workouts: db.workouts || {},
    habits: db.habits || {},
    bodyweight: db.bodyweight || [],
    prs: db.prs || {}
  });
});

// POST Restaurar o sincronizar caché desde cliente (localStorage) con merge por timestamp
app.post('/api/sync-cache', requireAuth, async (req, res, next) => {
  try {
    const { workouts, habits, bodyweight, prs } = req.body || {};
    const db = readDb();

    if (workouts && typeof workouts === 'object' && !Array.isArray(workouts)) {
      for (const [d, w] of Object.entries(workouts)) {
        if (!isValidDateKey(d) || !w || typeof w !== 'object') continue;
        const existing = db.workouts[d];
        if (!existing || getEntryTimestamp(w) >= getEntryTimestamp(existing)) {
          db.workouts[d] = w;
        }
      }
    }

    if (habits && typeof habits === 'object' && !Array.isArray(habits)) {
      for (const [d, h] of Object.entries(habits)) {
        if (!isValidDateKey(d) || !h || typeof h !== 'object') continue;
        const existing = db.habits[d];
        const cleanH = sanitizeHabit(h);
        if (!existing || getEntryTimestamp(cleanH) >= getEntryTimestamp(existing)) {
          db.habits[d] = cleanH;
        }
      }
    }

    if (Array.isArray(bodyweight) && bodyweight.length > 0) {
      const bwByDate = new Map((db.bodyweight || []).map((b) => [b.date, b]));
      for (const b of bodyweight) {
        const parsedWeight = clampNum(b?.weight, 20, 350, NaN);
        if (b && isValidDateKey(b.date) && Number.isFinite(parsedWeight) && !bwByDate.has(b.date)) {
          bwByDate.set(b.date, {
            date: b.date,
            weight: Math.round(parsedWeight * 10) / 10,
            notes: cleanStr(b.notes, 500)
          });
        }
      }
      db.bodyweight = Array.from(bwByDate.values()).sort((a, b) => a.date.localeCompare(b.date));
    }

    if (prs && typeof prs === 'object' && !Array.isArray(prs)) {
      for (const [exId, pr] of Object.entries(prs)) {
        if (!isSafeId(exId) || !pr || typeof pr !== 'object') continue;
        const existing = db.prs[exId];
        const incomingE1rm = Number(pr.e1rm) || 0;
        const existingE1rm = Number(existing?.e1rm) || 0;
        if (!existing || incomingE1rm > existingE1rm) {
          db.prs[exId] = pr;
        }
      }
    }

    await writeDb(db);
    res.json({ success: true, message: 'Caché sincronizada con éxito en el servidor', db });
  } catch (err) {
    next(err);
  }
});

// Helper para obtener IPs locales
function getLocalIps() {
  const nets = os.networkInterfaces();
  const results = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        results.push(net.address);
      }
    }
  }
  return results;
}

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const indexHtml = path.join(staticDir, 'index.html');
  if (fs.existsSync(indexHtml)) {
    return res.sendFile(indexHtml);
  }
  next();
});

// Manejo de errores (incluyendo CORS) sin filtrar stack traces
app.use((err, req, res, next) => {
  if (err && err.message === 'Origen no permitido por CORS') {
    return res.status(403).json({ error: 'Origen no permitido' });
  }
  console.error('Unhandled error:', err);
  return res.status(500).json({ error: 'Error interno del servidor' });
});

async function startServer() {
  await store.init();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`HábitoTracker - Rutina Thragg`);
    console.log(`======================================================`);
    console.log(`Local PC:      http://localhost:${PORT}`);
    const ips = getLocalIps();
    if (ips.length > 0) {
      console.log(`En tu móvil:   http://${ips[0]}:${PORT}`);
    }
    console.log(`Almacenamiento: ${store.getStorageMode()}`);
    console.log(`Seguridad:     ${DEMO_MODE ? 'Modo Demo (sin clave, datos en memoria)' : (APP_PASSWORD ? 'Protegido con APP_PASSWORD' : (IS_PROD ? '⚠️ BLOQUEADO (falta APP_PASSWORD)' : 'Modo local sin clave'))}`);
    console.log(`======================================================\n`);
    syncFromRenderCloud();
  });
}

startServer().catch((err) => {
  console.error('Error fatal al iniciar el servidor:', err);
  process.exit(1);
});
