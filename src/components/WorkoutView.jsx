import React, { useState, useEffect } from 'react';
import { LayoutGrid, Check, Moon, Pause, Play, Clock, Layers, Weight, ChevronRight, Footprints, Dumbbell, Activity, Cloud, CloudOff, RefreshCw, StickyNote, CalendarClock } from 'lucide-react';
import ExerciseCard from './ExerciseCard';
import RestTimer from './RestTimer';
import { getTodayLocal } from '../utils/date';

const isSetDone = (s) => s.checked || (parseFloat(s.weight) > 0 && parseInt(s.reps, 10) > 0);

export default function WorkoutView({
  currentPlan,
  currentDate,
  exerciseSetsState,
  previousSessions,
  onSetsChange,
  sessionNotes = '',
  onSessionNotesChange,
  syncStatus = 'synced',
  onRetrySync,
  onBackToToday,
  timerSeconds,
  onStartRest,
  onSaveWorkout,
  savingWorkout,
  collapsedExercises,
  setCollapsedExercises,
  onOpenHabits,
  onOpenMuscleModal,
  onOverrideSession
}) {
  // Timestamp-based session stopwatch persisted per date (survives tab switches & iOS screen lock)
  const stopwatchKey = `thragg_stopwatch_${currentDate || 'today'}`;
  const [stopwatchState, setStopwatchState] = useState(() => {
    try {
      const saved = localStorage.getItem(stopwatchKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.accumulatedMs === 'number') return parsed;
      }
    } catch {}
    return { running: true, startedAt: Date.now(), accumulatedMs: 0 };
  });

  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    try {
      const saved = localStorage.getItem(stopwatchKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.accumulatedMs === 'number') {
          setStopwatchState(parsed);
          setNowMs(Date.now());
          return;
        }
      }
    } catch {}
    const fresh = { running: true, startedAt: Date.now(), accumulatedMs: 0 };
    setStopwatchState(fresh);
    setNowMs(Date.now());
  }, [stopwatchKey]);

  useEffect(() => {
    try {
      localStorage.setItem(stopwatchKey, JSON.stringify(stopwatchState));
    } catch {}
  }, [stopwatchKey, stopwatchState]);

  const isStopwatchRunning = stopwatchState.running;
  const setIsStopwatchRunning = (updater) => {
    setStopwatchState((prev) => {
      const nextRunning = typeof updater === 'function' ? updater(prev.running) : updater;
      if (nextRunning === prev.running) return prev;
      const now = Date.now();
      if (nextRunning) {
        return { running: true, startedAt: now, accumulatedMs: prev.accumulatedMs };
      }
      const delta = prev.startedAt ? Math.max(0, now - prev.startedAt) : 0;
      return { running: false, startedAt: null, accumulatedMs: prev.accumulatedMs + delta };
    });
    setNowMs(Date.now());
  };

  useEffect(() => {
    if (!isStopwatchRunning) return;
    const tick = () => setNowMs(Date.now());
    const interval = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [isStopwatchRunning]);

  const elapsedMs = stopwatchState.accumulatedMs + (
    stopwatchState.running && stopwatchState.startedAt ? Math.max(0, nowMs - stopwatchState.startedAt) : 0
  );
  const stopwatchSeconds = Math.floor(elapsedMs / 1000);

  const formatStopwatch = (totalSecs) => {
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    const mm = mins.toString().padStart(2, '0');
    const ss = secs.toString().padStart(2, '0');
    return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
  };

  const formattedDate = currentDate
    ? new Date(currentDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })
    : '';

  const isViewingPastOrOtherDate = currentDate && currentDate !== getTodayLocal();

  const syncPill = (
    <button
      type="button"
      onClick={() => syncStatus === 'pending' && onRetrySync && onRetrySync()}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider border transition ${
        syncStatus === 'synced'
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25 cursor-default'
          : syncStatus === 'syncing'
            ? 'bg-blue-500/10 text-blue-300 border-blue-500/25 cursor-default'
            : 'bg-amber-500/15 text-amber-300 border-amber-500/35 hover:bg-amber-500/25 cursor-pointer active:scale-95'
      }`}
      title={
        syncStatus === 'synced'
          ? 'Datos guardados en Supabase'
          : syncStatus === 'syncing'
            ? 'Sincronizando con Supabase...'
            : 'Cambios locales pendientes · toca para subir ahora'
      }
    >
      {syncStatus === 'synced' ? (
        <Cloud className="w-2.5 h-2.5" />
      ) : syncStatus === 'syncing' ? (
        <RefreshCw className="w-2.5 h-2.5 animate-spin" />
      ) : (
        <CloudOff className="w-2.5 h-2.5" />
      )}
      <span>{syncStatus === 'synced' ? 'Nube' : syncStatus === 'syncing' ? 'Sync...' : 'Subir'}</span>
    </button>
  );

  const pastDateBanner = isViewingPastOrOtherDate ? (
    <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30">
      <div className="flex items-center gap-2 min-w-0">
        <CalendarClock className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="text-[11px] font-mono text-amber-200 truncate">
          Sesión del <strong className="text-white">{formattedDate}</strong>
        </span>
      </div>
      {onBackToToday && (
        <button
          type="button"
          onClick={onBackToToday}
          className="shrink-0 px-2.5 py-1 rounded-xl bg-amber-400 text-black font-mono text-[10px] font-black uppercase tracking-wider active:scale-95 transition"
        >
          Volver a hoy
        </button>
      )}
    </div>
  ) : null;

  const habitsButton = (
    <button
      type="button"
      onClick={onOpenHabits}
      className="w-11 h-11 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] active:scale-95 border border-white/10 flex items-center justify-center text-white transition relative shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-viltrum-crimson/60"
      title="Abrir hábitos diarios"
      aria-label="Abrir hábitos diarios"
    >
      <LayoutGrid className="w-5 h-5 text-zinc-300" />
      <span className="absolute top-2 right-2 w-2 h-2 bg-amber-400 rounded-full ring-2 ring-black" />
    </button>
  );

  if (!currentPlan) {
    return (
      <div className="py-24 text-center space-y-3 animate-fade-in select-none">
        <div className="w-10 h-10 border-2 border-viltrum-crimson border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-mono text-zinc-500">Cargando sesión de entrenamiento...</p>
      </div>
    );
  }

  // REST DAY VIEW (Only if isRestDay AND no recorded sets exist for this date)
  const hasRecordedSets = Object.values(exerciseSetsState || {}).some((sets) => (sets || []).some(isSetDone));

  if (currentPlan.isRestDay && !hasRecordedSets) {
    const sessionOptions = [
      { id: '1', label: 'Torso A', sub: 'Fuerza', day: 'Lunes', icon: Dumbbell },
      { id: '2', label: 'Pierna A', sub: 'Cuádriceps', day: 'Martes', icon: Activity },
      { id: '4', label: 'Torso B', sub: 'Hipertrofia', day: 'Jueves', icon: Dumbbell },
      { id: '5', label: 'Pierna B', sub: 'Cadena posterior', day: 'Viernes', icon: Activity },
    ];

    return (
      <div className="space-y-5 pb-36 animate-fade-in select-none">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pt-1">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold tracking-widest text-blue-400 uppercase">
                {formattedDate}
              </span>
              {syncPill}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-0.5">
              Día de descanso
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5 truncate">{currentPlan.sessionName}</p>
          </div>
          {habitsButton}
        </div>
        {pastDateBanner}

        {/* Rest Hero Card */}
        <div className="relative overflow-hidden p-6 rounded-3xl border border-blue-500/20 bg-gradient-to-b from-blue-950/40 to-[#0f0f14] text-center space-y-3">
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
          <div className="relative w-16 h-16 mx-auto rounded-3xl bg-blue-500/15 border border-blue-500/30 text-blue-300 flex items-center justify-center">
            <Moon className="w-8 h-8" />
          </div>
          <h2 className="relative text-xl font-bold text-white tracking-tight">
            Descanso &amp; recuperación
          </h2>
          <p className="relative text-sm text-zinc-400 max-w-sm mx-auto leading-relaxed">
            Sin cargas pesadas hoy. Deja que el sistema nervioso se recupere y ejecuta la rutina de movilidad.
          </p>
          <div className="relative flex items-center justify-center gap-2 pt-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-[11px] font-mono font-bold text-zinc-300">
              <Footprints className="w-3.5 h-3.5 text-blue-300" />
              8.000+ pasos
            </span>
            <button
              type="button"
              onClick={onOpenHabits}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-[11px] font-mono font-bold text-blue-200 transition cursor-pointer"
            >
              Ver hábitos
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Override Quick Switcher */}
        <div className="space-y-2.5">
          <div className="flex items-baseline justify-between px-1">
            <span className="text-[11px] font-mono uppercase tracking-widest text-zinc-400 font-bold">
              ¿Entrenas igualmente?
            </span>
            <span className="text-[10px] font-mono text-zinc-500">Carga una sesión</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {sessionOptions.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onOverrideSession && onOverrideSession(s.id)}
                  className="group p-3.5 rounded-2xl bg-[#121217] hover:bg-rose-500/10 active:scale-[0.98] border border-white/[0.07] hover:border-viltrum-crimson/40 transition text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-viltrum-crimson/60"
                >
                  <div className="flex items-center justify-between">
                    <span className="w-8 h-8 rounded-xl bg-white/[0.04] group-hover:bg-viltrum-crimson/20 border border-transparent flex items-center justify-center text-zinc-300 group-hover:text-rose-300 transition">
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="text-[9px] font-mono uppercase text-zinc-500 font-bold tracking-wider">{s.day}</span>
                  </div>
                  <span className="text-sm font-bold text-white block mt-2.5">{s.label}</span>
                  <span className="text-[11px] text-zinc-400 block">{s.sub}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ACTIVE WORKOUT VIEW
  const exercises = (currentPlan.exercises && currentPlan.exercises.length > 0)
    ? currentPlan.exercises
    : Object.keys(exerciseSetsState || {}).map((id) => ({
        id,
        name: id.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
        sets: (exerciseSetsState[id] || []).length || 3,
        reps: '8-10',
        targetRir: '1-2',
      }));

  const totalPlannedSets = exercises.reduce((acc, ex) => {
    const saved = exerciseSetsState?.[ex.id];
    return acc + (saved && saved.length ? saved.length : (ex.sets || 3));
  }, 0);
  const totalCompletedSets = Object.values(exerciseSetsState || {}).reduce(
    (acc, sets) => acc + (sets || []).filter(isSetDone).length,
    0
  );
  const totalVolume = Object.values(exerciseSetsState || {}).reduce(
    (acc, sets) =>
      acc + (sets || []).filter(isSetDone).reduce((a, s) => a + (parseFloat(s.weight) || 0) * (parseInt(s.reps, 10) || 0), 0),
    0
  );
  const progressPercent = totalPlannedSets > 0 ? Math.min(100, Math.round((totalCompletedSets / totalPlannedSets) * 100)) : 0;
  const isWorkoutComplete = totalPlannedSets > 0 && totalCompletedSets >= totalPlannedSets;

  const exerciseStatus = exercises.map((ex) => {
    const saved = exerciseSetsState?.[ex.id] || [];
    const planned = saved.length || ex.sets || 3;
    const done = saved.filter(isSetDone).length;
    return { id: ex.id, done, planned, complete: done > 0 && done >= planned };
  });
  const completedExercises = exerciseStatus.filter((e) => e.complete).length;
  const activeExerciseId = exerciseStatus.find((e) => !e.complete)?.id || null;

  const muscleGroups = Array.from(
    new Set(
      exercises.map((ex) => {
        const id = ex.id.toLowerCase();
        if (id.includes('banca') || id.includes('pecho')) return 'PECHO';
        if (id.includes('sentadilla') || id.includes('prensa') || id.includes('extension')) return 'CUÁDRICEPS';
        if (id.includes('rdl') || id.includes('femoral') || id.includes('isquio')) return 'ISQUIOS';
        if (id.includes('remo') || id.includes('jalon') || id.includes('espalda')) return 'ESPALDA';
        if (id.includes('press_militar') || id.includes('lateral')) return 'HOMBROS';
        if (id.includes('triceps') || id.includes('biceps')) return 'BRAZOS';
        return 'CORE';
      })
    )
  );

  const [sessionTitle, sessionSubtitle] = (() => {
    const parts = (currentPlan.sessionName || '').split(/\s[—–-]\s/);
    return [parts[0] || currentPlan.sessionName, parts.slice(1).join(' · ')];
  })();

  // Progress ring geometry
  const ringRadius = 26;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - progressPercent / 100);

  const formatVolume = (v) => (v >= 10000 ? `${(v / 1000).toFixed(1)}t` : `${Math.round(v).toLocaleString('es-ES')}`);

  return (
    <div className="space-y-4 pb-44 animate-fade-in select-none">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 pt-1">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-1.5 h-1.5 rounded-full bg-viltrum-crimson animate-pulse" />
            <span className="text-[11px] font-mono font-bold tracking-widest text-viltrum-crimson uppercase truncate">
              {currentPlan.name} · {formattedDate}
            </span>
            {syncPill}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-0.5 truncate">
            {sessionTitle}
          </h1>
          {sessionSubtitle && (
            <p className="text-xs text-zinc-400 mt-0.5 truncate">{sessionSubtitle}</p>
          )}
        </div>
        {habitsButton}
      </div>

      {pastDateBanner}

      {/* Session Summary Card */}
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-gradient-to-b from-[#16161c] to-[#0e0e12] p-4 shadow-lg">
        <div className="absolute -top-20 -right-16 w-56 h-56 rounded-full bg-viltrum-crimson/10 blur-3xl pointer-events-none" />

        <div className="relative flex items-center gap-4">
          {/* Progress Ring */}
          <div className="relative w-16 h-16 shrink-0">
            <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
              <circle cx="32" cy="32" r={ringRadius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
              <circle
                cx="32"
                cy="32"
                r={ringRadius}
                fill="none"
                stroke={isWorkoutComplete ? '#30d158' : 'url(#workoutRingGrad)'}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringOffset}
                className="transition-all duration-500 ease-out"
              />
              <defs>
                <linearGradient id="workoutRingGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#e11d48" />
                  <stop offset="100%" stopColor="#fb7185" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              {isWorkoutComplete ? (
                <Check className="w-6 h-6 text-apple-green stroke-[3]" />
              ) : (
                <span className="text-sm font-mono font-black text-white">{progressPercent}%</span>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex-1 grid grid-cols-3 gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setIsStopwatchRunning((r) => !r)}
              className="text-left rounded-2xl px-2 py-1.5 -mx-2 hover:bg-white/[0.04] transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-viltrum-crimson/60"
              aria-label={isStopwatchRunning ? 'Pausar cronómetro de sesión' : 'Reanudar cronómetro de sesión'}
              title={isStopwatchRunning ? 'Pausar' : 'Reanudar'}
            >
              <span className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-zinc-500 font-bold">
                {isStopwatchRunning ? <Clock className="w-3 h-3" /> : <Pause className="w-3 h-3 text-amber-400" />}
                Tiempo
              </span>
              <span className={`block text-base font-mono font-black tabular-nums mt-0.5 ${isStopwatchRunning ? 'text-white' : 'text-amber-300'}`}>
                {formatStopwatch(stopwatchSeconds)}
              </span>
            </button>

            <div className="px-0.5 py-1.5">
              <span className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-zinc-500 font-bold">
                <Layers className="w-3 h-3" />
                Series
              </span>
              <span className="block text-base font-mono font-black tabular-nums mt-0.5 text-white">
                {totalCompletedSets}
                <span className="text-zinc-500 font-bold text-xs">/{totalPlannedSets}</span>
              </span>
            </div>

            <div className="px-0.5 py-1.5">
              <span className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-zinc-500 font-bold">
                <Weight className="w-3 h-3" />
                Volumen
              </span>
              <span className="block text-base font-mono font-black tabular-nums mt-0.5 text-white truncate">
                {formatVolume(totalVolume)}
                <span className="text-zinc-500 font-bold text-xs"> kg</span>
              </span>
            </div>
          </div>
        </div>

        {/* Segmented exercise progress */}
        <div className="relative mt-4">
          <div className="flex gap-1">
            {exerciseStatus.map((e) => {
              const pct = e.planned > 0 ? Math.min(100, (e.done / e.planned) * 100) : 0;
              return (
                <div key={e.id} className="flex-1 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${e.complete ? 'bg-apple-green' : 'bg-viltrum-crimson'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-2 text-[10px] font-mono text-zinc-500">
            <span>
              <span className="text-zinc-300 font-bold">{completedExercises}</span> de {exercises.length} ejercicios
            </span>
            {!isStopwatchRunning && (
              <button
                type="button"
                onClick={() => setIsStopwatchRunning(true)}
                className="inline-flex items-center gap-1 text-amber-300 font-bold cursor-pointer hover:text-amber-200 transition"
              >
                <Play className="w-3 h-3 fill-current" /> Reanudar
              </button>
            )}
          </div>
        </div>

        {/* Muscle chips */}
        {muscleGroups.length > 0 && (
          <div className="relative mt-3 pt-3 border-t border-white/[0.06] flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
            {muscleGroups.map((m) => (
              <button
                key={m}
                type="button"
                onClick={onOpenMuscleModal}
                className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-white/[0.05] hover:bg-viltrum-crimson/15 text-zinc-300 hover:text-rose-200 border border-white/[0.06] hover:border-viltrum-crimson/30 cursor-pointer transition"
              >
                {m}
              </button>
            ))}
            <button
              type="button"
              onClick={onOpenMuscleModal}
              className="shrink-0 ml-auto inline-flex items-center gap-0.5 px-2 py-1 text-[10px] font-mono font-bold text-zinc-500 hover:text-white transition cursor-pointer"
            >
              Mapa <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Rest Timer */}
      <RestTimer
        initialSeconds={timerSeconds}
        exerciseName={currentPlan.name}
      />

      {/* Exercises List */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between px-1">
          <span className="text-[11px] font-mono uppercase tracking-widest text-zinc-400 font-bold">
            Ejercicios
          </span>
          <span className="text-[10px] font-mono text-zinc-500">{exercises.length} en total</span>
        </div>

        {exercises.map((ex, idx) => (
          <ExerciseCard
            key={ex.id}
            index={idx}
            isActive={ex.id === activeExerciseId}
            exercise={ex}
            savedSets={exerciseSetsState[ex.id] || []}
            previousHistory={previousSessions?.[ex.id] || null}
            onSetsChange={onSetsChange}
            onStartRest={onStartRest}
            isCollapsed={collapsedExercises.has(ex.id)}
            onToggleCollapse={(exId) => {
              setCollapsedExercises((prev) => {
                const next = new Set(prev);
                if (next.has(exId)) {
                  next.delete(exId);
                } else {
                  next.add(exId);
                }
                return next;
              });
            }}
          />
        ))}
      </div>

      {/* Session Notes Card */}
      {onSessionNotesChange && (
        <div className="rounded-3xl bg-[#121217] border border-white/[0.07] p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-zinc-400 font-bold">
              <StickyNote className="w-3.5 h-3.5 text-amber-400" />
              Notas de la sesión
            </span>
            {sessionNotes && (
              <span className="text-[10px] font-mono text-zinc-500">{sessionNotes.length}/500</span>
            )}
          </div>
          <textarea
            rows={2}
            maxLength={500}
            value={sessionNotes}
            onChange={(e) => onSessionNotesChange(e.target.value)}
            placeholder="Sensaciones, molestias, subir +2.5 kg próxima sesión..."
            className="w-full rounded-2xl bg-black/50 border border-white/[0.07] focus:border-viltrum-crimson/60 px-3 py-2.5 text-base sm:text-xs text-white placeholder:text-zinc-600 outline-none resize-none transition select-text"
          />
        </div>
      )}

      {/* Sticky Save Action (above bottom nav) */}
      <div
        className="fixed left-0 right-0 z-30 px-4 pointer-events-none"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 4.5rem)' }}
      >
        <div className="max-w-md mx-auto pointer-events-auto relative">
          <div className="absolute -inset-x-4 -top-8 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none" />
          <button
            type="button"
            onClick={onSaveWorkout}
            disabled={savingWorkout}
            className={`relative w-full h-14 rounded-2xl overflow-hidden font-extrabold text-sm text-white transition active:scale-[0.98] disabled:opacity-60 cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
              isWorkoutComplete
                ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-300/30 shadow-xl shadow-emerald-950/70'
                : 'bg-[#1a0b10] hover:bg-[#220d14] border-viltrum-crimson/40 shadow-xl shadow-rose-950/70'
            }`}
          >
            {/* Progress fill */}
            {!isWorkoutComplete && (
              <span
                className="absolute inset-y-0 left-0 bg-viltrum-crimson transition-all duration-500 ease-out"
                style={{ width: `${Math.max(progressPercent, 6)}%` }}
              />
            )}
            <span className="relative flex items-center justify-center gap-2">
              {savingWorkout ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="w-5 h-5 stroke-[3]" />
              )}
              <span>
                {savingWorkout
                  ? 'Guardando en la Bóveda...'
                  : isWorkoutComplete
                    ? 'Finalizar entrenamiento'
                    : `Guardar entrenamiento · ${totalCompletedSets}/${totalPlannedSets}`}
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
