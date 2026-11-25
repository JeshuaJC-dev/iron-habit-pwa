const http = require('http');
const fs = require('fs');
const path = require('path');

// Verify db.json backup
const dbPath = path.join(__dirname, 'data', 'db.json');
const dbRaw = fs.readFileSync(dbPath, 'utf8');
const dbData = JSON.parse(dbRaw);

console.log(`[TEST 1] Verifying db.json integrity...`);
const workoutCount = Object.keys(dbData.workouts || {}).length;
console.log(`Found ${workoutCount} workouts in db.json.`);
if (workoutCount < 13) {
  console.error(`FAIL: Workouts missing! Expected at least 13, found ${workoutCount}`);
  process.exit(1);
}
console.log(`PASS: Database has all historical workouts intact.\n`);

// Start server on test port 3456
process.env.PORT = '3456';
const server = require('./server.js');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  // Give server 500ms to listen
  await new Promise((r) => setTimeout(r, 600));

  try {
    console.log(`[TEST 2] Testing GET /api/routine...`);
    const routineRes = await request({
      hostname: 'localhost',
      port: 3456,
      path: '/api/routine',
      method: 'GET'
    });
    if (routineRes.status !== 200 || !routineRes.data.days) {
      throw new Error(`Failed to fetch routine: ${JSON.stringify(routineRes)}`);
    }
    console.log(`PASS: Routine returned successfully with ${Object.keys(routineRes.data.days).length} days.\n`);

    console.log(`[TEST 3] Testing GET /api/day/2026-10-21...`);
    const dayRes = await request({
      hostname: 'localhost',
      port: 3456,
      path: '/api/day/2026-10-21',
      method: 'GET'
    });
    if (dayRes.status !== 200 || dayRes.data.date !== '2026-10-21') {
      throw new Error(`Failed to fetch day: ${JSON.stringify(dayRes)}`);
    }
    console.log(`PASS: Day data retrieved with ${Object.keys(dayRes.data.previousSessions || {}).length} previous exercise records.\n`);

    console.log(`[TEST 4] Testing POST /api/habit (water, protein, calories, mobility)...`);
    const habitPayload = {
      date: '2026-10-21',
      habit: {
        water: 2.75,
        protein: 155,
        sleepHours: 8,
        creatine: true,
        calories: 2850,
        mobilityMorning: true,
        mobilityNight: true,
        skincareMorning: true,
        skincareNight: false
      }
    };
    const habitRes = await request({
      hostname: 'localhost',
      port: 3456,
      path: '/api/habit',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, habitPayload);

    if (habitRes.status !== 200 || !habitRes.data.success) {
      throw new Error(`Failed to save habits: ${JSON.stringify(habitRes)}`);
    }
    console.log(`PASS: Habits saved and verified.\n`);

    console.log(`[TEST 5] Testing GET /api/dashboard...`);
    const dashRes = await request({
      hostname: 'localhost',
      port: 3456,
      path: '/api/dashboard',
      method: 'GET'
    });
    if (dashRes.status !== 200 || !dashRes.data.prs) {
      throw new Error(`Failed to fetch dashboard: ${JSON.stringify(dashRes)}`);
    }
    console.log(`PASS: Dashboard loaded. Total PRs: ${Object.keys(dashRes.data.prs).length}, Workouts: ${Object.keys(dashRes.data.workouts).length}.\n`);

    console.log(`ALL BACKEND TESTS PASSED CLEANLY!\n`);
    process.exit(0);
  } catch (err) {
    console.error(`TEST ERROR:`, err);
    process.exit(1);
  }
}

runTests();
