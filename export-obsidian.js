require('dotenv').config();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'db.json');
const vaultPath = (process.env.OBSIDIAN_VAULT_PATH || '').trim();

function isValidDateKey(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const [y, m, d] = str.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

if (!vaultPath) {
  console.error('Configura OBSIDIAN_VAULT_PATH en tu archivo .env antes de exportar.');
  process.exit(1);
}

if (!fs.existsSync(dbPath)) {
  console.error('db.json no encontrado');
  process.exit(1);
}

const resolvedVault = path.resolve(vaultPath);
if (!fs.existsSync(resolvedVault)) {
  fs.mkdirSync(resolvedVault, { recursive: true });
}

const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
let count = 0;

for (const [date, w] of Object.entries(db.workouts || {})) {
  if (!isValidDateKey(date) || !w || typeof w !== 'object') continue;

  const filePath = path.resolve(resolvedVault, `Sesion_${date}.md`);
  if (!filePath.startsWith(resolvedVault + path.sep)) continue;

  const h = (db.habits || {})[date] || {};

  let md = `---\n`;
  md += `aliases: [Sesión ${date}, ${w.sessionName || 'Entreno'}]\n`;
  md += `tags: [sesion, entrenamiento, registro]\n`;
  md += `fecha: ${date}\n`;
  md += `dia: ${w.dayId || ''}\n`;
  md += `completado_at: ${w.completedAt || ''}\n`;
  md += `---\n\n`;

  md += `# ${w.sessionName || 'Sesión de Entrenamiento'} — ${date}\n\n`;
  if (w.notes) {
    md += `> **Notas de la sesión:** ${w.notes}\n\n`;
  }

  md += `## Levantamientos y Series\n\n`;
  for (const [exId, sets] of Object.entries(w.exercises || {})) {
    if (!Array.isArray(sets)) continue;
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
    md += `- **Agua:** ${h.water || '—'} L\n`;
    md += `- **Sueño:** ${h.sleepHours || '—'} h (Calidad: ${h.sleepQuality || '—'}/10)\n`;
    md += `- **Movilidad Mañana:** ${h.mobilityMorning ? 'Sí' : 'No'} | **Noche:** ${h.mobilityNight ? 'Sí' : 'No'}\n`;
    md += `- **Bienestar:** ${h.wellness || '—'}/10\n`;
    if (h.notes) md += `- **Notas:** ${h.notes}\n`;
    md += `\n`;
  }

  md += `---\n*Exportado automáticamente desde HábitoTracker*\n`;
  fs.writeFileSync(filePath, md, 'utf-8');
  count++;
}

console.log(`${count} sesiones exportadas exitosamente.`);
