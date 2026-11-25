import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import WorkoutView from './components/WorkoutView';
import BottomNavBar from './components/BottomNavBar';
import Toast from './components/Toast';
import { X } from 'lucide-react';
import defaultRoutine from '../data/routine.json';
import { getTodayLocal } from './utils/date';

const PlanView = lazy(() => import('./components/PlanView'));
const HistoryView = lazy(() => import('./components/HistoryView'));
const ProfileView = lazy(() => import('./components/ProfileView'));
const HabitsDrawer = lazy(() => import('./components/HabitsDrawer'));
const MuscleVisualizer = lazy(() => import('./components/MuscleVisualizer'));
const VaultModal = lazy(() => import('./components/VaultModal'));
const RirModal = lazy(() => import('./components/Modals').then((m) => ({ default: m.RirModal })));
const MobilityModal = lazy(() => import('./components/Modals').then((m) => ({ default: m.MobilityModal })));

const TabFallback = () => (
  <div className="py-24 text-center space-y-3 select-none">
    <div className="w-8 h-8 border-2 border-viltrum-crimson border-t-transparent rounded-full animate-spin mx-auto" />
  </div>
);

const getLocalCache = (key, fallback) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
};

const setLocalCache = (key, val) => {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.warn('LocalStorage save error:', e);
  }
};

const getEntryTs = (entry) => {
  if (!entry || typeof entry !== 'object') return 0;
  const raw = entry.updatedAt || entry.completedAt;
  if (!raw) return 0;
  const ts = Date.parse(raw);
  return Number.isFinite(ts) ? ts : 0;
};

const mergeByTimestamp = (localMap = {}, serverMap = {}) => {
  const merged = { ...serverMap };
  let hasLocalNewer = false;

  for (const [date, localEntry] of Object.entries(localMap || {})) {
    if (!localEntry || typeof localEntry !== 'object') continue;
    const serverEntry = serverMap?.[date];
    if (!serverEntry) {
      merged[date] = localEntry;
      hasLocalNewer = true;
    } else if (getEntryTs(localEntry) > getEntryTs(serverEntry)) {
      merged[date] = localEntry;
      hasLocalNewer = true;
    }
  }
  return { merged, hasLocalNewer };
};

export default function App() {
  const [currentDate, setCurrentDate] = useState(() => getTodayLocal());
  const [routineData, setRoutineData] = useState(defaultRoutine);
  const [currentDayData, setCurrentDayData] = useState(null);
  const [currentOverride, setCurrentOverride] = useState('auto');
  // 'plan' | 'workout' | 'history' | 'profile'
  const [activeTab, setActiveTab] = useState('workout');

  // Drawers & Modals
  const [isHabitsOpen, setIsHabitsOpen] = useState(false);
  const [isMuscleModalOpen, setIsMuscleModalOpen] = useState(false);
  const [isRirOpen, setIsRirOpen] = useState(false);
  const [isMobilityOpen, setIsMobilityOpen] = useState(false);
  const [isVaultOpen, setIsVaultOpen] = useState(false);

  // Muscle focus
  const [focusedMuscle, setFocusedMuscle] = useState(null);
  const [hoveredExerciseId, setHoveredExerciseId] = useState(null);

  // Timer & Toast
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [toast, setToast] = useState({ show: false, message: '', type: 'check' });

  // Loading & Sync states
  const [savingWorkout, setSavingWorkout] = useState(false);
  const [savingHabits, setSavingHabits] = useState(false);
  const [syncingObsidian, setSyncingObsidian] = useState(false);
  const [syncStatus, setSyncStatus] = useState('syncing'); // 'synced' | 'syncing' | 'pending'

  // State
  const [allWorkouts, setAllWorkouts] = useState(() => getLocalCache('thragg_workouts_cache', {}));
  const [exerciseSetsState, setExerciseSetsState] = useState({});
  const [sessionNotes, setSessionNotes] = useState('');
  const [habitsState, setHabitsState] = useState(() => {
    const cached = getLocalCache('thragg_habits_cache', {});
    const todayStr = getTodayLocal();
    return cached[todayStr] || {};
  });
  const [dashboardData, setDashboardData] = useState(null);
  const [collapsedExercises, setCollapsedExercises] = useState(new Set());
  const toastTimeoutRef = useRef(null);

  const showToastMsg = (message, type = 'check') => {
    setToast({ show: true, message, type });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToast({ show: false, message: '', type: 'check' });
    }, 3200);
  };

  const syncPendingToServer = async (showFeedback = false) => {
    setSyncStatus('syncing');
    const cachedWorkouts = getLocalCache('thragg_workouts_cache', {});
    const cachedHabits = getLocalCache('thragg_habits_cache', {});
    const cachedBw = getLocalCache('thragg_bodyweight_cache', []);
    const cachedPrs = getLocalCache('thragg_prs_cache', {});
    try {
      const res = await fetch('/api/sync-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workouts: cachedWorkouts,
          habits: cachedHabits,
          bodyweight: cachedBw,
          prs: cachedPrs
        })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data?.db) {
        setLocalCache('thragg_workouts_cache', data.db.workouts || {});
        setAllWorkouts(data.db.workouts || {});
        setLocalCache('thragg_habits_cache', data.db.habits || {});
        setLocalCache('thragg_bodyweight_cache', data.db.bodyweight || []);
        setLocalCache('thragg_prs_cache', data.db.prs || {});
        setDashboardData(data.db);
      }
      setSyncStatus('synced');
      if (showFeedback) showToastMsg('Sincronizado con la nube', 'check');
    } catch {
      setSyncStatus('pending');
      if (showFeedback) showToastMsg('Sin conexión · pendiente de subir', 'error');
    }
  };

  // Ping silencioso para despertar Render en cuanto abres la app + auto-reintento al volver online
  useEffect(() => {
    fetch('/api/health').catch(() => {});
    const handleOnline = () => {
      syncPendingToServer(false);
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // Sync cache with server (merge seguro por timestamp por fecha)
  useEffect(() => {
    const cachedWorkouts = getLocalCache('thragg_workouts_cache', {});
    const cachedHabits = getLocalCache('thragg_habits_cache', {});
    const cachedBw = getLocalCache('thragg_bodyweight_cache', []);
    const cachedPrs = getLocalCache('thragg_prs_cache', {});

    setSyncStatus('syncing');
    fetch('/api/dashboard')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((serverData) => {
        const { merged: mergedWorkouts, hasLocalNewer: workoutsNewer } = mergeByTimestamp(
          cachedWorkouts,
          serverData?.workouts || {}
        );
        const { merged: mergedHabits, hasLocalNewer: habitsNewer } = mergeByTimestamp(
          cachedHabits,
          serverData?.habits || {}
        );

        const serverBw = Array.isArray(serverData?.bodyweight) ? serverData.bodyweight : [];
        const bwMap = new Map(serverBw.map((b) => [b.date, b]));
        let bwNewer = false;
        for (const b of Array.isArray(cachedBw) ? cachedBw : []) {
          if (b?.date && !bwMap.has(b.date)) {
            bwMap.set(b.date, b);
            bwNewer = true;
          }
        }
        const mergedBw = Array.from(bwMap.values()).sort((a, b) => a.date.localeCompare(b.date));

        const mergedPrs = { ...(serverData?.prs || {}) };
        let prsNewer = false;
        for (const [exId, pr] of Object.entries(cachedPrs || {})) {
          const existing = mergedPrs[exId];
          if (!existing || (Number(pr?.e1rm) || 0) > (Number(existing?.e1rm) || 0)) {
            mergedPrs[exId] = pr;
            prsNewer = true;
          }
        }

        setLocalCache('thragg_workouts_cache', mergedWorkouts);
        setAllWorkouts(mergedWorkouts);
        setLocalCache('thragg_habits_cache', mergedHabits);
        setLocalCache('thragg_bodyweight_cache', mergedBw);
        setLocalCache('thragg_prs_cache', mergedPrs);

        setDashboardData({
          workouts: mergedWorkouts,
          habits: mergedHabits,
          bodyweight: mergedBw,
          prs: mergedPrs
        });

        if (workoutsNewer || habitsNewer || bwNewer || prsNewer) {
          fetch('/api/sync-cache', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              workouts: mergedWorkouts,
              habits: mergedHabits,
              bodyweight: mergedBw,
              prs: mergedPrs
            })
          })
            .then((r) => setSyncStatus(r.ok ? 'synced' : 'pending'))
            .catch(() => setSyncStatus('pending'));
        } else {
          setSyncStatus('synced');
        }
      })
      .catch((err) => {
        console.warn('Servidor offline: cargando desde caché local', err);
        setSyncStatus('pending');
        setDashboardData({
          workouts: cachedWorkouts,
          habits: cachedHabits,
          bodyweight: cachedBw,
          prs: cachedPrs
        });
      });
  }, []);

  useEffect(() => {
    fetch('/api/routine')
      .then((r) => r.json())
      .then((data) => setRoutineData(data))
      .catch((err) => console.error('Error fetching routine:', err));
  }, []);

  useEffect(() => {
    fetch(`/api/day/${currentDate}`)
      .then((r) => r.json())
      .then((data) => {
        const cachedWorkouts = getLocalCache('thragg_workouts_cache', {});
        const cachedHabits = getLocalCache('thragg_habits_cache', {});
        const serverWorkout = data?.workout;
        const localWorkout = cachedWorkouts[currentDate];
        let fallbackWorkout = null;
        if (serverWorkout && localWorkout) {
          fallbackWorkout = getEntryTs(localWorkout) > getEntryTs(serverWorkout) ? localWorkout : serverWorkout;
        } else {
          fallbackWorkout = localWorkout || serverWorkout || null;
        }

        // Smart habit conflict resolution (newer local changes are preserved)
        const serverHabit = data?.habit;
        const localHabit = cachedHabits[currentDate];
        let fallbackHabit = null;
        if (serverHabit && localHabit) {
          const sTime = serverHabit.updatedAt ? new Date(serverHabit.updatedAt).getTime() : 0;
          const lTime = localHabit.updatedAt ? new Date(localHabit.updatedAt).getTime() : 0;
          fallbackHabit = lTime >= sTime ? localHabit : serverHabit;
        } else {
          fallbackHabit = localHabit || serverHabit || null;
        }

        let previousSessions = data?.previousSessions || {};
        if (Object.keys(previousSessions).length === 0 && Object.keys(cachedWorkouts).length > 0) {
          const dates = Object.keys(cachedWorkouts).sort();
          for (const d of dates) {
            if (d < currentDate && cachedWorkouts[d]?.exercises) {
              for (const [exId, sets] of Object.entries(cachedWorkouts[d].exercises)) {
                previousSessions[exId] = { date: d, sets };
              }
            }
          }
        }

        setCurrentDayData({
          ...data,
          workout: fallbackWorkout,
          habit: fallbackHabit,
          previousSessions
        });

        if (fallbackWorkout?.dayId) {
          setCurrentOverride(fallbackWorkout.dayId);
        } else {
          setCurrentOverride('auto');
        }

        if (fallbackWorkout?.exercises) {
          setExerciseSetsState(fallbackWorkout.exercises);
        } else {
          setExerciseSetsState({});
        }
        setSessionNotes(fallbackWorkout?.notes || '');
        if (fallbackHabit) {
          setHabitsState(fallbackHabit);
        } else {
          setHabitsState({});
        }
      })
      .catch((err) => {
        console.error('Error fetching day, usando caché local:', err);
        const cachedWorkouts = getLocalCache('thragg_workouts_cache', {});
        const cachedHabits = getLocalCache('thragg_habits_cache', {});
        const previousSessions = {};
        const dates = Object.keys(cachedWorkouts).sort();
        for (const d of dates) {
          if (d < currentDate && cachedWorkouts[d]?.exercises) {
            for (const [exId, sets] of Object.entries(cachedWorkouts[d].exercises)) {
              previousSessions[exId] = { date: d, sets };
            }
          }
        }
        if (cachedWorkouts[currentDate]?.dayId) {
          setCurrentOverride(cachedWorkouts[currentDate].dayId);
        } else {
          setCurrentOverride('auto');
        }

        const localHabit = cachedHabits[currentDate] || null;
        if (localHabit) {
          setHabitsState(localHabit);
        } else {
          setHabitsState({});
        }

        if (cachedWorkouts[currentDate]) {
          setExerciseSetsState(cachedWorkouts[currentDate].exercises || {});
          setSessionNotes(cachedWorkouts[currentDate].notes || '');
          setCurrentDayData({
            date: currentDate,
            workout: cachedWorkouts[currentDate],
            habit: localHabit,
            previousSessions
          });
        } else {
          setExerciseSetsState({});
          setSessionNotes('');
          setCurrentDayData({
            date: currentDate,
            workout: null,
            habit: localHabit,
            previousSessions
          });
        }
      });
  }, [currentDate]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetch('/api/dashboard')
        .then((r) => r.json())
        .then((data) => setDashboardData(data))
        .catch(console.error);
    }
  }, [activeTab]);

  const allCachedWorkouts = allWorkouts;

  // Calculate real total tonnage moved across all historical workouts (memoized)
  const totalKgMoved = useMemo(() => {
    return Object.values(allCachedWorkouts || {}).reduce((acc, w) => {
      if (!w || !w.exercises) return acc;
      return acc + Object.values(w.exercises).reduce((eAcc, sets) => {
        return eAcc + (sets || []).reduce((sAcc, s) => sAcc + (parseFloat(s.weight) || 0) * (parseInt(s.reps, 10) || 0), 0);
      }, 0);
    }, 0);
  }, [allCachedWorkouts]);

  const realPrCount = Object.keys(dashboardData?.prs || {}).length;
  const realSessionCount = Object.keys(allCachedWorkouts || {}).length;
  const latestWeight = dashboardData?.bodyweight?.length 
    ? dashboardData.bodyweight[dashboardData.bodyweight.length - 1].weight 
    : (routineData?.profile?.weight || 76);

  const dateObj = new Date(currentDate + 'T12:00:00');
  const dayIndex = dateObj.getDay(); // 0 is Sunday, 1 is Monday...
  const cachedWorkoutForCurrentDate = allCachedWorkouts[currentDate];
  const effectiveDayId = currentOverride !== 'auto'
    ? currentOverride
    : (cachedWorkoutForCurrentDate?.dayId || dayIndex.toString());
  const currentPlan = routineData?.days?.[effectiveDayId] || null;

  const handleStartRest = (seconds) => {
    // Request notification permission synchronously inside the user tap gesture
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      try {
        Notification.requestPermission().catch(() => {});
      } catch (e) {}
    }
    // Set iOS AudioSession to 'ambient' so background music (Spotify/Apple Music) never pauses
    if (typeof navigator !== 'undefined' && 'audioSession' in navigator) {
      try {
        navigator.audioSession.type = 'ambient';
      } catch (e) {}
    }
    setTimerSeconds({ seconds, ts: Date.now() });
  };

  const handleSaveWorkout = async () => {
    if (!currentPlan || currentPlan.isRestDay) return;
    setSavingWorkout(true);

    const exercisesPayload = {};
    Object.entries(exerciseSetsState).forEach(([exId, sets]) => {
      const exMeta = (currentPlan?.exercises || []).find((e) => e.id === exId);
      const validSets = (sets || [])
        .filter((s) => parseFloat(s.weight) > 0 || parseInt(s.reps, 10) > 0)
        .map((s) => ({
          weight: parseFloat(s.weight) || 0,
          reps: parseInt(s.reps, 10) || 0,
          rir: s.rir !== '' && s.rir !== null && s.rir !== undefined ? parseInt(s.rir, 10) : null,
          exerciseName: exMeta ? exMeta.name : exId
        }));
      if (validSets.length > 0) {
        exercisesPayload[exId] = validSets;
      }
    });

    const prevWorkouts = getLocalCache('thragg_workouts_cache', {});
    const nowIso = new Date().toISOString();
    const localWorkoutEntry = {
      date: currentDate,
      dayId: effectiveDayId,
      sessionName: currentPlan.sessionName,
      notes: sessionNotes || '',
      completedAt: nowIso,
      updatedAt: nowIso,
      exercises: exercisesPayload
    };
    const nextAllWorkouts = { ...prevWorkouts, [currentDate]: localWorkoutEntry };
    setLocalCache('thragg_workouts_cache', nextAllWorkouts);
    setAllWorkouts(nextAllWorkouts);
    setSyncStatus('syncing');

    try {
      const res = await fetch('/api/workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: currentDate,
          dayId: effectiveDayId,
          sessionName: currentPlan.sessionName,
          notes: sessionNotes || '',
          exercises: exercisesPayload
        })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      if (result.success) {
        setSyncStatus('synced');
        if (result.newPrs && result.newPrs.length > 0) {
          const prNames = result.newPrs
            .map((p) => `${p.name} (${p.weight}kg × ${p.reps})`)
            .join(', ');
          showToastMsg(`¡RÉCORD PERSONAL! ${prNames}`, 'award');
        } else {
          showToastMsg('Entrenamiento registrado', 'check');
        }
        const updated = await (await fetch(`/api/day/${currentDate}`)).json();
        setCurrentDayData(updated);
      }
    } catch (err) {
      setSyncStatus('pending');
      showToastMsg('Guardado en el móvil (pendiente de subir)', 'error');
    } finally {
      setSavingWorkout(false);
    }
  };

  const handleSetsChange = (exerciseId, newSets) => {
    setExerciseSetsState((prev) => {
      const next = {
        ...prev,
        [exerciseId]: newSets
      };
      // Auto-save to LocalStorage immediately on every set change / check
      const prevWorkouts = getLocalCache('thragg_workouts_cache', {});
      const existing = prevWorkouts[currentDate] || {};
      prevWorkouts[currentDate] = {
        ...existing,
        date: currentDate,
        dayId: effectiveDayId,
        sessionName: currentPlan?.sessionName || 'Entrenamiento',
        updatedAt: new Date().toISOString(),
        exercises: next
      };
      setLocalCache('thragg_workouts_cache', prevWorkouts);
      setAllWorkouts({ ...prevWorkouts });
      setSyncStatus('pending');
      return next;
    });
  };

  const handleSessionNotesChange = (val) => {
    setSessionNotes(val);
    const prevWorkouts = getLocalCache('thragg_workouts_cache', {});
    const existing = prevWorkouts[currentDate] || {};
    prevWorkouts[currentDate] = {
      ...existing,
      date: currentDate,
      dayId: effectiveDayId,
      sessionName: currentPlan?.sessionName || 'Entrenamiento',
      notes: val,
      updatedAt: new Date().toISOString(),
      exercises: existing.exercises || exerciseSetsState
    };
    setLocalCache('thragg_workouts_cache', prevWorkouts);
    setAllWorkouts({ ...prevWorkouts });
    setSyncStatus('pending');
  };

  const handleSaveHabits = async (updatedHabit) => {
    const habitToSave = {
      ...(updatedHabit || habitsState),
      updatedAt: new Date().toISOString()
    };
    setHabitsState(habitToSave);
    setSavingHabits(true);
    const prevHabits = getLocalCache('thragg_habits_cache', {});
    setLocalCache('thragg_habits_cache', { ...prevHabits, [currentDate]: habitToSave });

    try {
      const res = await fetch('/api/habit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: currentDate,
          habit: habitToSave
        })
      });
      const result = await res.json();
      if (result.success && result.habit) {
        setLocalCache('thragg_habits_cache', { ...prevHabits, [currentDate]: result.habit });
        showToastMsg('Hábitos guardados correctamente', 'check');
      }
    } catch (err) {
      console.warn('Guardado en caché local offline:', err);
      showToastMsg('Guardado localmente (offline)', 'check');
    } finally {
      setSavingHabits(false);
    }
  };

  const handleSaveBodyweight = async (weight) => {
    const parsed = parseFloat(weight);
    if (!Number.isFinite(parsed) || parsed < 20 || parsed > 350) return;
    const todayStr = getTodayLocal();
    const prevBw = getLocalCache('thragg_bodyweight_cache', []);
    const nextBw = [...prevBw.filter((b) => b.date !== todayStr), { date: todayStr, weight: parsed, notes: '' }]
      .sort((a, b) => a.date.localeCompare(b.date));
    setLocalCache('thragg_bodyweight_cache', nextBw);
    setDashboardData((prev) => (prev ? { ...prev, bodyweight: nextBw } : prev));

    try {
      const res = await fetch('/api/bodyweight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: todayStr, weight: parsed })
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.bodyweight)) {
          setLocalCache('thragg_bodyweight_cache', data.bodyweight);
          setDashboardData((prev) => (prev ? { ...prev, bodyweight: data.bodyweight } : prev));
        }
        showToastMsg(`Peso registrado (${parsed} kg)`, 'check');
      }
    } catch {
      showToastMsg(`Peso guardado localmente (${parsed} kg)`, 'check');
    }
  };

  const handleSyncObsidian = async () => {
    setSyncingObsidian(true);
    try {
      const res = await fetch('/api/export-obsidian', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        showToastMsg(`Bóveda sincronizada (${data.exportedCount} días)`, 'check');
      } else {
        showToastMsg(data.error || 'Error al sincronizar con Obsidian', 'error');
      }
    } catch (err) {
      showToastMsg('Servidor no disponible para sync Obsidian', 'error');
    } finally {
      setSyncingObsidian(false);
    }
  };

  const handleRestoreBackup = async (json) => {
    try {
      if (json.workouts) {
        setLocalCache('thragg_workouts_cache', json.workouts);
        setAllWorkouts(json.workouts);
      }
      if (json.habits) setLocalCache('thragg_habits_cache', json.habits);
      if (json.bodyweight) setLocalCache('thragg_bodyweight_cache', json.bodyweight);
      if (json.prs) setLocalCache('thragg_prs_cache', json.prs);

      await fetch('/api/sync-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json)
      });

      const dayData = await (await fetch(`/api/day/${currentDate}`)).json();
      setCurrentDayData(dayData);
      if (dayData?.workout?.exercises) setExerciseSetsState(dayData.workout.exercises);
      if (dayData?.habit) setHabitsState(dayData.habit);

      const dash = await (await fetch('/api/dashboard')).json();
      setDashboardData(dash);
    } catch (err) {
      console.error('Error al restaurar backup:', err);
      throw err;
    }
  };

  const handleLoadSessionFromPlan = (dateStr, dayId) => {
    if (dayId) setCurrentOverride(dayId);
    setCurrentDate(dateStr);
    const cachedWorkouts = getLocalCache('thragg_workouts_cache', {});
    if (cachedWorkouts[dateStr]?.exercises) {
      setExerciseSetsState(cachedWorkouts[dateStr].exercises);
    } else {
      setExerciseSetsState({});
    }
    setActiveTab('workout');
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-rose-500/30">
      <Toast toast={toast} />

      {/* Main Responsive Container */}
      <main className="flex-1 max-w-md w-full mx-auto px-4 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-[calc(env(safe-area-inset-bottom,0px)+6rem)]">
        <Suspense fallback={<TabFallback />}>
          <div key={activeTab} className="ios-page-transition">
            {/* TAB 1: PLAN */}
            {activeTab === 'plan' && (
              <PlanView
                routineData={routineData}
                currentDate={currentDate}
                onSelectDate={setCurrentDate}
                onLoadSession={handleLoadSessionFromPlan}
                onGoToWorkout={() => setActiveTab('workout')}
                allWorkouts={allCachedWorkouts}
                todayHabit={habitsState}
                onOpenHabits={() => setIsHabitsOpen(true)}
              />
            )}

            {/* TAB 2: ENTRENO (WORKOUT) */}
            {activeTab === 'workout' && (
              <WorkoutView
                currentPlan={currentPlan}
                currentDate={currentDate}
                exerciseSetsState={exerciseSetsState}
                previousSessions={currentDayData?.previousSessions}
                onSetsChange={handleSetsChange}
                sessionNotes={sessionNotes}
                onSessionNotesChange={handleSessionNotesChange}
                syncStatus={syncStatus}
                onRetrySync={() => syncPendingToServer(true)}
                onBackToToday={() => {
                  setCurrentOverride('auto');
                  setCurrentDate(getTodayLocal());
                }}
                timerSeconds={timerSeconds}
                onStartRest={handleStartRest}
                onSaveWorkout={handleSaveWorkout}
                savingWorkout={savingWorkout}
                collapsedExercises={collapsedExercises}
                setCollapsedExercises={setCollapsedExercises}
                onOpenHabits={() => setIsHabitsOpen(true)}
                onOpenMuscleModal={() => setIsMuscleModalOpen(true)}
                onOverrideSession={setCurrentOverride}
              />
            )}

            {/* TAB 3: HISTORIAL */}
            {activeTab === 'history' && (
              <HistoryView
                dashboardData={dashboardData}
                allWorkouts={allCachedWorkouts}
                routineData={routineData}
                onSelectSession={(date) => {
                  const w = allCachedWorkouts[date];
                  if (w) {
                    if (w.dayId) setCurrentOverride(w.dayId);
                    if (w.exercises) setExerciseSetsState(w.exercises);
                  }
                  setCurrentDate(date);
                  setActiveTab('workout');
                }}
              />
            )}

            {/* TAB 4: PERFIL */}
            {activeTab === 'profile' && (
              <ProfileView
                totalSessions={realSessionCount}
                totalRecords={realPrCount}
                totalKgMoved={totalKgMoved}
                latestWeight={latestWeight}
                routineProfile={routineData?.profile}
                onSyncObsidian={handleSyncObsidian}
                isSyncingObsidian={syncingObsidian}
                onOpenVault={() => setIsVaultOpen(true)}
                onSaveBodyweight={handleSaveBodyweight}
                onOpenRir={() => setIsRirOpen(true)}
                onOpenMobility={() => setIsMobilityOpen(true)}
              />
            )}
          </div>
        </Suspense>
      </main>

      {/* FIXED BOTTOM NAVIGATION BAR (4 TABS) */}
      <BottomNavBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* LAZY DRAWERS & MODALS (solo se descargan al abrirse) */}
      <Suspense fallback={null}>
        {isHabitsOpen && (
          <HabitsDrawer
            isOpen={isHabitsOpen}
            onClose={() => setIsHabitsOpen(false)}
            habit={habitsState}
            onChange={setHabitsState}
            onSave={handleSaveHabits}
            saving={savingHabits}
            currentDate={currentDate}
          />
        )}

        {/* MUSCLE ANATOMY MODAL */}
        {isMuscleModalOpen && currentPlan && !currentPlan.isRestDay && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none"
            onClick={() => setIsMuscleModalOpen(false)}
          >
            <div
              className="w-full max-w-lg bg-[#0e0e12] border border-white/10 rounded-3xl p-5 shadow-2xl relative max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-rose-400 font-bold block">
                    MAPA ANATÓMICO
                  </span>
                  <h3 className="text-lg font-bold text-white">
                    Músculos Involucrados
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMuscleModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center text-zinc-400 hover:text-white transition"
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>

              <MuscleVisualizer
                currentPlan={currentPlan}
                activeExerciseId={hoveredExerciseId}
                focusedMuscle={focusedMuscle}
                onSelectMuscle={setFocusedMuscle}
              />
            </div>
          </div>
        )}

        {/* EXTRA HELPER MODALS */}
        {isRirOpen && (
          <RirModal
            isOpen={isRirOpen}
            onClose={() => setIsRirOpen(false)}
            rirGuide={routineData?.rirGuide}
          />
        )}
        {isMobilityOpen && (
          <MobilityModal
            isOpen={isMobilityOpen}
            onClose={() => setIsMobilityOpen(false)}
            mobilityData={routineData?.mobility}
          />
        )}
        {isVaultOpen && (
          <VaultModal
            isOpen={isVaultOpen}
            onClose={() => setIsVaultOpen(false)}
            onSyncObsidian={handleSyncObsidian}
            isSyncingObsidian={syncingObsidian}
            onRestoreBackup={handleRestoreBackup}
            showToast={showToastMsg}
          />
        )}
      </Suspense>
    </div>
  );
}
