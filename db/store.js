const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const EMPTY_DB = () => ({
  workouts: {},
  habits: {},
  bodyweight: [],
  prs: {},
  pushSubscriptions: []
});

function normalizeDb(raw) {
  if (!raw || typeof raw !== 'object') return EMPTY_DB();
  return {
    workouts: raw.workouts && typeof raw.workouts === 'object' && !Array.isArray(raw.workouts) ? raw.workouts : {},
    habits: raw.habits && typeof raw.habits === 'object' && !Array.isArray(raw.habits) ? raw.habits : {},
    bodyweight: Array.isArray(raw.bodyweight) ? raw.bodyweight : [],
    prs: raw.prs && typeof raw.prs === 'object' && !Array.isArray(raw.prs) ? raw.prs : {},
    pushSubscriptions: Array.isArray(raw.pushSubscriptions) ? raw.pushSubscriptions : []
  };
}

class StorageAdapter {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.dbFile = path.join(dataDir, 'db.json');
    this.demoFile = path.join(dataDir, 'db.demo.json');
    this.demoMode = process.env.DEMO_MODE === 'true';
    this.databaseUrl = (process.env.DATABASE_URL || '').trim();
    this.pool = null;
    this.cache = null;
    this.writeQueue = Promise.resolve();
    this.storageMode = 'local-json';
  }

  getStorageMode() {
    return this.storageMode;
  }

  ensureLocalFile() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.dbFile)) {
      fs.writeFileSync(this.dbFile, JSON.stringify(EMPTY_DB(), null, 2), 'utf-8');
    }
  }

  readLocalJson() {
    try {
      if (!fs.existsSync(this.dbFile)) return EMPTY_DB();
      const raw = fs.readFileSync(this.dbFile, 'utf-8');
      return normalizeDb(JSON.parse(raw));
    } catch (err) {
      console.error('Error leyendo db.json local:', err);
      return EMPTY_DB();
    }
  }

  writeLocalJsonAtomic(data) {
    this.ensureLocalFile();
    const payload = JSON.stringify(data, null, 2);
    const tmpFile = `${this.dbFile}.${process.pid}.${Date.now()}.tmp`;
    try {
      fs.writeFileSync(tmpFile, payload, 'utf-8');
      fs.renameSync(tmpFile, this.dbFile);
    } catch (err) {
      try {
        if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      } catch {}
      throw err;
    }
  }

  async init() {
    if (this.demoMode) {
      try {
        if (fs.existsSync(this.demoFile)) {
          const raw = fs.readFileSync(this.demoFile, 'utf-8');
          this.cache = normalizeDb(JSON.parse(raw));
        } else {
          this.cache = EMPTY_DB();
        }
      } catch (err) {
        console.error('Error leyendo db.demo.json:', err);
        this.cache = EMPTY_DB();
      }
      this.storageMode = 'demo-memory';
      console.log('🧪 [Demo Mode] Datos de ejemplo cargados en memoria (sin escritura en disco/BD).');
      return this.cache;
    }

    if (this.databaseUrl) {
      try {
        const useSsl = process.env.DATABASE_SSL !== 'false';
        this.pool = new Pool({
          connectionString: this.databaseUrl,
          ssl: useSsl ? { rejectUnauthorized: false } : false,
          max: 5,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000
        });

        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS tracker_store (
            section TEXT PRIMARY KEY,
            data JSONB NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);

        const { rows } = await this.pool.query('SELECT section, data FROM tracker_store');
        if (rows.length === 0) {
          // Primera vez en la nube: migrar datos desde db.json local si existen
          const seed = this.readLocalJson();
          await this.persistPostgres(seed);
          this.cache = seed;
          console.log('☁️ [PostgreSQL] Tabla inicializada y migrada desde db.json local.');
        } else {
          const loaded = EMPTY_DB();
          for (const row of rows) {
            if (row.section in loaded) {
              loaded[row.section] = row.data;
            }
          }
          this.cache = normalizeDb(loaded);
          console.log('☁️ [PostgreSQL] Conectado y datos cargados en memoria.');
        }

        this.storageMode = 'postgres';
        return this.cache;
      } catch (err) {
        console.error('❌ [PostgreSQL] Error conectando a DATABASE_URL, usando fallback local:', err.message);
        if (this.pool) {
          await this.pool.end().catch(() => {});
          this.pool = null;
        }
      }
    }

    // Modo local JSON
    this.ensureLocalFile();
    this.cache = this.readLocalJson();
    this.storageMode = 'local-json';
    return this.cache;
  }

  getDb() {
    if (!this.cache) {
      this.ensureLocalFile();
      this.cache = this.readLocalJson();
    }
    return this.cache;
  }

  async persistPostgres(data) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const sections = ['workouts', 'habits', 'bodyweight', 'prs', 'pushSubscriptions'];
      for (const section of sections) {
        await client.query(
          `INSERT INTO tracker_store (section, data, updated_at)
           VALUES ($1, $2::jsonb, NOW())
           ON CONFLICT (section)
           DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
          [section, JSON.stringify(data[section])]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  saveDb(data) {
    const normalized = normalizeDb(data);
    this.cache = normalized;

    // Cola serializada para evitar race conditions en peticiones simultáneas
    this.writeQueue = this.writeQueue.then(async () => {
      if (this.storageMode === 'demo-memory') {
        return;
      }
      if (this.storageMode === 'postgres' && this.pool) {
        await this.persistPostgres(normalized);
      } else {
        this.writeLocalJsonAtomic(normalized);
      }
    });

    return this.writeQueue;
  }
}

module.exports = { StorageAdapter };
