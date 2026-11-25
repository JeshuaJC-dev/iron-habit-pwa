import React, { useState } from 'react';
import { Check, ChevronDown, ChevronUp, LayoutGrid, Dumbbell, Moon, Clock, Sparkles, ArrowRight, Activity, Flame } from 'lucide-react';
import { formatLocalDate } from '../utils/date';

export default function PlanView({
  routineData = {},
  currentDate = '',
  onSelectDate,
  onLoadSession,
  onGoToWorkout,
  allWorkouts = {},
  todayHabit = {},
  onOpenHabits
}) {
  const [expandedDayId, setExpandedDayId] = useState(null);

  const dayKeysMap = [
    { key: 'monday', id: '1', shortLabel: 'LUN' },
    { key: 'tuesday', id: '2', shortLabel: 'MAR' },
    { key: 'wednesday', id: '3', shortLabel: 'MIÉ' },
    { key: 'thursday', id: '4', shortLabel: 'JUE' },
    { key: 'friday', id: '5', shortLabel: 'VIE' },
    { key: 'saturday', id: '6', shortLabel: 'SÁB' },
    { key: 'sunday', id: '0', shortLabel: 'DOM' },
  ];

  // Get current week's dates (Monday to Sunday)
  const today = new Date();
  const currentDayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday...
  const mondayOffset = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
  const mondayDate = new Date(today);
  mondayDate.setDate(today.getDate() + mondayOffset);

  const weekDays = dayKeysMap.map((dItem, idx) => {
    const d = new Date(mondayDate);
    d.setDate(mondayDate.getDate() + idx);
    const dateStr = formatLocalDate(d);
    const dayNumber = d.getDate();
    const plan = routineData?.days?.[dItem.id] || { name: 'Descanso', sessionName: 'Descanso Total', exercises: [], isRestDay: true };
    const workoutData = allWorkouts[dateStr];
    const isCompleted = !!workoutData?.completedAt;
    const isToday = dateStr === currentDate;

    return {
      dayKey: dItem.key,
      dayId: dItem.id,
      dateStr,
      dayNumber,
      shortLabel: dItem.shortLabel,
      plan,
      isCompleted,
      isToday,
      exercisesCount: plan.exercises?.length || 0,
      setsCount: plan.exercises?.reduce((acc, ex) => acc + (ex.sets || 3), 0) || 0,
      isRestDay: !!plan.isRestDay,
    };
  });

  // Calculate real week progress
  const totalPlannedSessions = weekDays.filter((w) => !w.isRestDay).length; // 4 sessions
  const completedSessions = weekDays.filter((w) => w.isCompleted).length;
  const progressPercent = totalPlannedSessions > 0 ? Math.round((completedSessions / totalPlannedSessions) * 100) : 0;

  // Active today obj
  const todayObj = weekDays.find((w) => w.isToday) || weekDays[0];

  const handleToggleDay = (dayId) => {
    setExpandedDayId((prev) => (prev === dayId ? null : dayId));
  };

  const handleStartSession = (dateStr, dayId) => {
    if (onLoadSession) {
      onLoadSession(dateStr, dayId);
    } else {
      if (onSelectDate) onSelectDate(dateStr);
      if (onGoToWorkout) onGoToWorkout();
    }
  };

  return (
    <div className="space-y-4 pb-32 animate-fade-in select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <span className="text-[11px] font-mono font-bold tracking-widest text-viltrum-crimson uppercase">
            RUTINA THRAGG v3.3 · 4 DÍAS
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-0.5">
            Plan de entrenamiento
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Estructura Torso / Pierna adaptada a 191 cm
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenHabits}
          className="w-10 h-10 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] active:scale-95 border border-transparent flex items-center justify-center text-white transition relative shrink-0"
          title="Abrir hábitos diarios"
        >
          <LayoutGrid className="w-5 h-5 text-zinc-300" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-amber-400 rounded-full" />
        </button>
      </div>

      {/* PROGRESS BAR DE LA SEMANA */}
      <div className="p-4 sm:p-5 rounded-3xl bg-[#121217] border border-white/[0.07] space-y-2.5 shadow-sm">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-zinc-400 font-bold uppercase tracking-wider text-[11px]">
            SEMANA ACTUAL
          </span>
          <span className="text-emerald-400 font-bold text-sm">
            {completedSessions} / {totalPlannedSessions} entrenamientos
          </span>
        </div>

        <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-viltrum-crimson to-rose-400 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono pt-0.5">
          <span>{totalPlannedSessions - completedSessions > 0 ? `Quedan ${totalPlannedSessions - completedSessions} sesiones para completar la semana` : '¡Objetivo semanal completado!'}</span>
          <span className="text-white font-bold">{progressPercent}%</span>
        </div>
      </div>

      {/* LIST OF WEEKLY DAYS CARDS (EXPANDABLE IN PLACE) */}
      <div className="space-y-2.5">
        {weekDays.map((w) => {
          const isExpanded = expandedDayId === w.dayId;

          return (
            <div
              key={w.dayKey}
              className={`rounded-3xl border transition-all overflow-hidden ${
                w.isToday
                  ? 'bg-rose-950/20 border-viltrum-crimson/50 shadow-md shadow-rose-950/40 ring-1 ring-viltrum-crimson/30'
                  : w.isCompleted
                  ? 'bg-[#121217] border-emerald-500/30'
                  : 'bg-[#121217] border-white/[0.07]'
              }`}
            >
              {/* Day Header Bar (Tap to expand exercises in-place) */}
              <div
                onClick={() => handleToggleDay(w.dayId)}
                className="p-3.5 sm:p-4 hover:bg-white/[0.03] transition-all cursor-pointer flex items-center justify-between gap-3 active:scale-98"
              >
                {/* Left Date Box */}
                <div
                  className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center shrink-0 border ${
                    w.isToday
                      ? 'bg-viltrum-crimson text-white border-rose-400 shadow-md shadow-rose-950/60'
                      : 'bg-white/[0.05] text-zinc-300 border-transparent'
                  }`}
                >
                  <span className="text-[10px] font-mono uppercase font-bold tracking-wider">
                    {w.shortLabel}
                  </span>
                  <span className="text-base font-mono font-black">
                    {w.dayNumber}
                  </span>
                </div>

                {/* Center Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    {w.isCompleted ? (
                      <span className="text-[10px] font-mono uppercase font-bold text-emerald-400 tracking-wider">
                        COMPLETADO
                      </span>
                    ) : w.isToday ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-mono uppercase font-black bg-viltrum-crimson/20 text-viltrum-crimson border border-viltrum-crimson/30">
                        HOY · EN CURSO
                      </span>
                    ) : w.isRestDay ? (
                      <span className="text-[10px] font-mono uppercase font-semibold text-blue-400 tracking-wider">
                        DESCANSO
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono uppercase font-semibold text-zinc-400 tracking-wider">
                        PROGRAMADO
                      </span>
                    )}
                  </div>

                  <h4 className="text-sm sm:text-base font-bold text-white truncate">
                    {w.plan.sessionName}
                  </h4>

                  <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
                    {w.isRestDay
                      ? 'Recuperación y descompresión espinal'
                      : `${w.exercisesCount} ejercicios · ${w.setsCount} series`}
                  </p>
                </div>

                {/* Right Toggle Arrow */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-mono font-bold text-zinc-400 hidden sm:inline">
                    {isExpanded ? 'Contraer' : 'Ver rutina'}
                  </span>
                  <div
                    className={`p-1.5 rounded-full bg-white/5 transition-transform duration-300 ${
                      isExpanded ? 'rotate-180 bg-rose-500/20 text-rose-300' : 'text-zinc-400'
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Expanded Exercises / Rest Details */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-2 border-t border-transparent bg-black/40 space-y-3 animate-fade-in">
                  {w.isRestDay ? (
                    <div className="p-3.5 rounded-2xl bg-blue-950/20 border border-blue-500/20 space-y-2">
                      <div className="flex items-center gap-2 text-blue-400">
                        <Moon className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Protocolo de Recuperación</span>
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        8.000+ pasos diarios, descompresión espinal con dead hangs para columna de 191 cm y protocolo de movilidad matutina/nocturna.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-mono text-zinc-400 pb-1 border-b border-transparent">
                        <span>EJERCICIOS PROGRAMADOS ({w.plan.exercises?.length || 0})</span>
                        <span>SERIES × REPS</span>
                      </div>

                      {w.plan.exercises?.map((ex, exIdx) => (
                        <div
                          key={ex.id || exIdx}
                          className="p-3 rounded-2xl bg-white/[0.03] border border-transparent flex flex-col gap-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-mono font-bold text-zinc-500">
                                #{exIdx + 1}
                              </span>
                              <span className="text-xs sm:text-sm font-bold text-white truncate">
                                {ex.name}
                              </span>
                              {ex.isMainLift && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase bg-viltrum-crimson/20 text-viltrum-crimson border border-viltrum-crimson/30 shrink-0">
                                  Básico
                                </span>
                              )}
                            </div>

                            <span className="text-xs font-mono font-bold text-emerald-400 shrink-0">
                              {ex.sets} × {ex.reps}
                            </span>
                          </div>

                          {/* Exercise Cues / Rest */}
                          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                            <span>{ex.notes || (ex.targetRir ? `Objetivo RIR ${ex.targetRir}` : 'Rango completo')}</span>
                            <span className="flex items-center gap-1 text-zinc-500">
                              <Clock className="w-3 h-3" />
                              {ex.restSeconds ? `${ex.restSeconds}s` : '90s'}
                            </span>
                          </div>
                        </div>
                      ))}

                      {/* Action Button to launch / open workout */}
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => handleStartSession(w.dateStr, w.dayId)}
                          className={`w-full py-3 rounded-2xl active:scale-98 font-bold text-xs font-mono transition flex items-center justify-center gap-2 border ${
                            w.isToday
                              ? 'bg-viltrum-crimson hover:bg-rose-600 text-white border-rose-400/30 shadow-lg shadow-rose-950/60'
                              : 'bg-white/10 hover:bg-white/15 text-white border-transparent'
                          }`}
                        >
                          <Dumbbell className="w-4 h-4" />
                          <span>
                            {w.isToday ? 'Comenzar entrenamiento de hoy' : `Abrir sesión en Entreno (${w.shortLabel})`}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* FLOATING QUICK BAR FOR TODAY'S WORKOUT */}
      <div className="fixed bottom-20 left-4 right-4 z-30 max-w-md mx-auto">
        <button
          type="button"
          onClick={() => handleStartSession(todayObj.dateStr, todayObj.dayId)}
          className={`w-full py-3.5 px-5 rounded-2xl active:scale-98 font-bold text-sm shadow-xl flex items-center justify-between transition border ${
            todayObj.isRestDay
              ? 'bg-[#181820] hover:bg-[#20202a] text-blue-300 border-blue-500/30 shadow-black/80'
              : 'bg-viltrum-crimson hover:bg-rose-600 text-white shadow-rose-950/80 border-rose-400/30'
          }`}
        >
          <div className="text-left">
            <span
              className={`text-[10px] font-mono uppercase tracking-wider block font-semibold ${
                todayObj.isRestDay ? 'text-zinc-400' : 'text-rose-200'
              }`}
            >
              {todayObj.isRestDay ? 'HOY ES DESCANSO' : 'ENTRENAMIENTO DE HOY'}
            </span>
            <span className="text-sm font-extrabold text-white">
              {todayObj.plan.sessionName}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-white">
              {todayObj.isRestDay ? 'Ver descanso' : 'Ir a entrenar'}
            </span>
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </div>
        </button>
      </div>
    </div>
  );
}
