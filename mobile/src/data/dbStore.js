import AsyncStorage from '@react-native-async-storage/async-storage';
import initialDb from '../../data/db.json';
import routineDef from '../../data/routine.json';

const DB_STORAGE_KEY = '@thragg_tracker_db_v1';
const ROUTINE_STORAGE_KEY = '@thragg_tracker_routine_v1';

class DbStore {
  constructor() {
    this.db = null;
    this.routine = routineDef;
    this.listeners = new Set();
  }

  async init() {
    try {
      const storedDb = await AsyncStorage.getItem(DB_STORAGE_KEY);
      if (storedDb) {
        const parsed = JSON.parse(storedDb);
        // Merge with initialDb to ensure all historical sessions (all 13 workouts) are present
        const mergedWorkouts = { ...(initialDb.workouts || {}), ...(parsed.workouts || {}) };
        const mergedHabits = { ...(initialDb.habits || {}), ...(parsed.habits || {}) };
        const mergedPrs = { ...(initialDb.prs || {}), ...(parsed.prs || {}) };
        this.db = {
          workouts: mergedWorkouts,
          habits: mergedHabits,
          prs: mergedPrs,
        };
      } else {
        // First run: load the full 13-workout database
        this.db = initialDb;
        await AsyncStorage.setItem(DB_STORAGE_KEY, JSON.stringify(initialDb));
      }

      // Check routine
      const storedRoutine = await AsyncStorage.getItem(ROUTINE_STORAGE_KEY);
      if (storedRoutine) {
        this.routine = JSON.parse(storedRoutine);
      } else {
        this.routine = routineDef;
        await AsyncStorage.setItem(ROUTINE_STORAGE_KEY, JSON.stringify(routineDef));
      }
    } catch (err) {
      console.warn('Error loading db store:', err);
      this.db = initialDb;
      this.routine = routineDef;
    }
    this.notify();
    return this.db;
  }

  getRoutine() {
    return this.routine || routineDef;
  }

  getDayWorkout(dateStr) {
    if (!this.db || !this.db.workouts) return null;
    return this.db.workouts[dateStr] || null;
  }

  getDayHabits(dateStr) {
    if (!this.db || !this.db.habits) return null;
    return this.db.habits[dateStr] || null;
  }

  getAllWorkouts() {
    return this.db?.workouts || {};
  }

  getPrs() {
    return this.db?.prs || {};
  }

  async saveDayWorkout(dateStr, workoutData) {
    if (!this.db) await this.init();
    if (!this.db.workouts) this.db.workouts = {};

    this.db.workouts[dateStr] = {
      ...workoutData,
      date: dateStr,
      updatedAt: new Date().toISOString(),
    };

    // Recalculate PRs
    this.recalculatePrs();

    await AsyncStorage.setItem(DB_STORAGE_KEY, JSON.stringify(this.db));
    this.notify();

    // Async sync with cloud in background if connected
    this.syncToCloud(dateStr);
    return this.db.workouts[dateStr];
  }

  recalculatePrs() {
    const prs = { ...(this.db.prs || {}) };
    const workouts = this.db.workouts || {};

    for (const [date, w] of Object.entries(workouts)) {
      if (!w.exercises) continue;
      for (const [exId, sets] of Object.entries(w.exercises)) {
        for (const s of sets) {
          const weight = parseFloat(s.weight) || 0;
          const reps = parseInt(s.reps, 10) || 0;
          if (weight > 0 && reps > 0) {
            const e1rm = Math.round(weight * (1 + reps / 30) * 10) / 10;
            if (!prs[exId] || e1rm > (prs[exId].e1rm || 0)) {
              prs[exId] = {
                weight,
                reps,
                e1rm,
                date,
                exerciseName: exId,
              };
              s.isPr = true;
            }
          }
        }
      }
    }
    this.db.prs = prs;
  }

  async syncToCloud(dateStr) {
    try {
      const apiUrl = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/+$/, '');
      const w = this.db.workouts[dateStr];
      if (!apiUrl || !w) return;
      await fetch(`${apiUrl}/api/day/${dateStr}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workout: w }),
      });
    } catch (e) {
      // Offline fallback: saved locally in AsyncStorage, zero loss
    }
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    for (const cb of this.listeners) {
      try {
        cb(this.db);
      } catch (e) {}
    }
  }
}

export const dbStore = new DbStore();
