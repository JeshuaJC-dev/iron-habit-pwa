const fs = require('fs');

async function testAll() {
  console.log('==================================================');
  console.log('   🔱 TEST DE INTEGRIDAD COMPLETA - HABITOTRACKER');
  console.log('==================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, desc) {
    total++;
    if (condition) {
      console.log('  [PASS] ' + desc);
      passed++;
    } else {
      console.error('  [FAIL] ' + desc);
    }
  }

  // 1. Local Database
  console.log('1. BASE DE DATOS LOCAL (data/db.json)');
  const db = JSON.parse(fs.readFileSync('data/db.json', 'utf8'));
  const workoutCount = Object.keys(db.workouts || {}).length;
  assert(workoutCount === 17, 'Total de entrenamientos es 17 (encontrados: ' + workoutCount + ')');
  assert(!!db.workouts['2026-10-26'], 'Entrenamiento del 26-10-2026 presente');
  const oct26 = db.workouts['2026-10-26'];
  assert(oct26 && oct26.exercises && oct26.exercises.press_banca && oct26.exercises.press_banca[0].weight === 55, 'Press banca 55kg en sesion 26-10 registrado correctamente');
  assert(oct26 && oct26.exercises.remo_pendlay && oct26.exercises.remo_pendlay[0].weight === 60, 'Remo Pendlay 60kg registrado correctamente');
  assert(oct26 && oct26.exercises.ext_triceps_polea_lunes, 'Triceps de Torso A registrado correctamente');

  // 2. Rutina Definición
  console.log('\n2. CONFIGURACIÓN DE RUTINA (data/routine.json)');
  const routine = JSON.parse(fs.readFileSync('data/routine.json', 'utf8'));
  assert(routine.profile.occupation.includes('Prácticas'), 'Ocupación actualizada a Prácticas/Estudio');
  const jueves = routine.days['4'];
  const tienePeckDeck = jueves.exercises.some(e => e.id === 'peck_deck');
  assert(tienePeckDeck, 'Peck Deck añadido a Jueves (Torso B)');
  const tieneTricepsOverhead = jueves.exercises.some(e => e.name.toLowerCase().includes('overhead'));
  assert(tieneTricepsOverhead, 'Extensión overhead tríceps configurada en Jueves');
  const viernes = routine.days['5'];
  const tieneFemoralSentado = viernes.exercises.some(e => e.id === 'curl_femoral_sentado');
  assert(tieneFemoralSentado, 'Curl femoral sentado configurado en Viernes (Pierna B)');

  // 3. Obsidian Vault (opcional, requiere OBSIDIAN_VAULT_PATH)
  const vaultPath = (process.env.OBSIDIAN_VAULT_PATH || '').trim();
  if (vaultPath) {
    console.log('\n3. BÓVEDA OBSIDIAN');
    assert(fs.existsSync(vaultPath), 'Directorio de sesiones de Obsidian existe');
  } else {
    console.log('\n3. BÓVEDA OBSIDIAN (omitido: configura OBSIDIAN_VAULT_PATH para verificar)');
  }

  // 4. Servidor Local HTTP
  console.log('\n4. SERVIDOR LOCAL (http://localhost:3333)');
  try {
    const localRes = await fetch('http://localhost:3333/api/routine');
    assert(localRes.status === 200, 'API /api/routine responde 200 OK');
    const healthRes = await fetch('http://localhost:3333/api/health');
    const healthData = await healthRes.json();
    assert(healthData.ok === true, 'API /api/health devuelve ok: true');
  } catch (e) {
    assert(false, 'Servidor local no responde: ' + e.message);
  }

  // 5. Servidor Nube Render (opcional, requiere RENDER_API_URL)
  const renderUrl = (process.env.RENDER_API_URL || '').replace(/\/+$/, '');
  if (renderUrl) {
    console.log(`\n5. SERVIDOR EN LA NUBE (${renderUrl})`);
    try {
      const cloudRes = await fetch(`${renderUrl}/api/health`);
      assert(cloudRes.status === 200, 'Cloud Render responde 200 OK');
    } catch (e) {
      assert(false, 'Cloud Render error: ' + e.message);
    }
  } else {
    console.log('\n5. SERVIDOR EN LA NUBE (omitido: configura RENDER_API_URL para verificar)');
  }

  // 6. Frontend Dist Bundle & PWA / Audio / Notification Integrity
  console.log('\n6. BUNDLE COMPILADO, AUDIO SPOTIFY & NOTIFICACIONES PWA');
  assert(fs.existsSync('dist/index.html'), 'dist/index.html generado');
  assert(fs.existsSync('dist/manifest.json'), 'dist/manifest.json PWA generado');
  assert(fs.existsSync('dist/sw.js'), 'dist/sw.js Service Worker generado');
  assert(fs.existsSync('dist/icon-192.png'), 'dist/icon-192.png icono de notificación generado');
  const distFiles = fs.readdirSync('dist/assets');
  assert(distFiles.some(f => f.endsWith('.js')), 'JavaScript bundle de producción generado');
  assert(distFiles.some(f => f.endsWith('.css')), 'CSS bundle de producción generado');

  const timerSrc = fs.readFileSync('src/components/RestTimer.jsx', 'utf8');
  assert(timerSrc.includes("audioSession.type = 'ambient'"), 'Modo audioSession ambient configurado para no pausar Spotify');
  assert(!timerSrc.includes('<audio'), 'Sin etiquetas <audio> silenciosas que roben el foco de Spotify');
  assert(timerSrc.includes('ctx.close()'), 'AudioContext se cierra tras el pitido para liberar el canal de audio');

  const swSrc = fs.readFileSync('public/sw.js', 'utf8');
  assert(swSrc.includes('event.waitUntil(timerPromise)'), 'Service Worker mantiene vivo el cronómetro con event.waitUntil');

  console.log('\n==================================================');
  console.log(' RESULTADO FINAL: ' + passed + ' / ' + total + ' TESTS PASADOS EXITOSAMENTE');
  console.log('==================================================');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

testAll();
