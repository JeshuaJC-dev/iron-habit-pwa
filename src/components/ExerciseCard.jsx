import React, { useState } from 'react';
import { Plus, Minus, Check, Sparkles, ChevronDown, ChevronUp, History, Flame, Target, ArrowUpRight, Zap, Timer } from 'lucide-react';
import NumberWheelPicker from './NumberWheelPicker';
import { isAutoRestEnabled, triggerSafeVibrate } from '../utils/preferences';

// Shared column template for set header + rows: SET | ANTERIOR | PESO | REPS | RIR | OK
const SET_GRID = 'grid grid-cols-[26px_minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_40px] gap-1.5 items-center';

// Epley 1RM calculation for progressive overload comparison
const calcE1RM = (weight, reps) => {
  const w = parseFloat(weight) || 0;
  const r = parseInt(reps, 10) || 0;
  if (w <= 0 || r <= 0) return 0;
  if (r === 1) return w;
  return Math.round(w * (1 + r / 30) * 10) / 10;
};

// Autofill empty subsequent sets based on the completed set
const autofillRemainingSets = (currentSets, fromIdx, newWeight, newReps, newRir) => {
  return currentSets.map((s, i) => {
    // Only auto-fill subsequent sets that are NOT checked yet
    // and that are either completely blank or were already auto-suggested
    const isBlank = (!s.weight || s.weight === '' || s.weight === '0' || s.isSuggested) &&
                    (!s.reps || s.reps === '' || s.reps === '0' || s.isSuggested);
    if (i > fromIdx && !s.checked && isBlank) {
      return {
        ...s,
        weight: newWeight,
        reps: newReps,
        rir: newRir !== undefined && newRir !== '' ? newRir : s.rir,
        isSuggested: true
      };
    }
    return s;
  });
};

export default function ExerciseCard({
  exercise,
  savedSets = [],
  previousHistory = null,
  onSetsChange,
  onStartRest,
  onHover,
  onClick,
  isCollapsed = false,
  onToggleCollapse,
  index = null,
  isActive = false
}) {
  const targetSetsCount = exercise.sets || 3;
  const isTimedExercise =
    exercise.reps?.toString().toLowerCase().includes('s') ||
    exercise.name?.toLowerCase().includes('plancha') ||
    exercise.id?.toLowerCase().includes('plancha') ||
    exercise.name?.toLowerCase().includes('hang') ||
    exercise.id?.toLowerCase().includes('dead_hang');

  const sets = savedSets.length > 0 ? savedSets : Array.from({ length: targetSetsCount }, () => ({
    weight: '',
    reps: '',
    rir: '',
    checked: false
  }));

  const [pickerState, setPickerState] = useState({
    isOpen: false,
    setIndex: 0,
    initialTab: 'weight',
  });

  const handleOpenPicker = (idx, tab = 'weight') => {
    setPickerState({
      isOpen: true,
      setIndex: idx,
      initialTab: tab,
    });
  };

  const handleSaveFromWheel = ({ weight, reps, rir }) => {
    const targetIdx = pickerState.setIndex;
    let updated = sets.map((s, i) => {
      if (i === targetIdx) {
        return {
          ...s,
          weight: weight,
          reps: reps,
          rir: rir !== '' ? rir : s.rir,
          isSuggested: false
        };
      }
      return s;
    });

    // Auto-fill subsequent sets with this set's weight and reps if empty
    updated = autofillRemainingSets(updated, targetIdx, weight, reps, rir);
    onSetsChange(exercise.id, updated);
  };

  const handleSaveAndNext = ({ weight, reps, rir }) => {
    const targetIdx = pickerState.setIndex;
    let updated = sets.map((s, i) => {
      if (i === targetIdx) {
        return {
          ...s,
          weight: weight,
          reps: reps,
          rir: rir !== '' ? rir : s.rir,
          isSuggested: false
        };
      }
      return s;
    });

    // Auto-fill subsequent sets with this set's weight and reps if empty
    updated = autofillRemainingSets(updated, targetIdx, weight, reps, rir);
    onSetsChange(exercise.id, updated);

    if (targetIdx < sets.length - 1) {
      setPickerState({
        isOpen: true,
        setIndex: targetIdx + 1,
      });
    } else {
      setPickerState({ isOpen: false, setIndex: 0 });
    }
  };

  const handleSetChange = (index, field, value) => {
    const updated = sets.map((s, i) => {
      if (i === index) return { ...s, [field]: value, isSuggested: false };
      return s;
    });
    onSetsChange(exercise.id, updated);
  };

  const handleToggleCheck = (index) => {
    const s = sets[index];
    const willBeChecked = !s.checked;
    let updated = sets.map((item, i) => {
      if (i === index) return { ...item, checked: willBeChecked, isSuggested: false };
      return item;
    });

    // If marking as checked and it has values, auto-populate subsequent empty sets!
    if (willBeChecked && (s.weight || s.reps)) {
      updated = autofillRemainingSets(updated, index, s.weight, s.reps, s.rir);
    }

    onSetsChange(exercise.id, updated);
    triggerSafeVibrate(willBeChecked ? 15 : 8);

    if (willBeChecked && exercise.rest && isAutoRestEnabled()) {
      let seconds = 90;
      if (exercise.rest.includes('3 min')) seconds = 180;
      else if (exercise.rest.includes('2.5 min')) seconds = 150;
      else if (exercise.rest.includes('2 min')) seconds = 120;
      else if (exercise.rest.includes('60s')) seconds = 60;
      else if (exercise.rest.includes('90s')) seconds = 90;
      onStartRest(seconds);
    }
  };

  const handleAddSet = (e) => {
    e.stopPropagation();
    onSetsChange(exercise.id, [...sets, { weight: '', reps: '', rir: '', checked: false }]);
  };

  const handleRemoveSet = (e) => {
    e.stopPropagation();
    if (sets.length <= 1) return;
    onSetsChange(exercise.id, sets.slice(0, -1));
  };

  // Summary counts for collapsed badge
  const checkedSetsCount = sets.filter((s) => s.checked || (s.weight > 0 && s.reps > 0)).length;
  const isFullyCompleted = checkedSetsCount > 0 && checkedSetsCount >= sets.length;

  const totalVolume = sets.reduce((acc, s) => {
    const w = parseFloat(s.weight) || 0;
    const r = parseInt(s.reps, 10) || 0;
    return acc + (w * r);
  }, 0);

  // Rest label for header chip
  const restLabel = exercise.rest ? exercise.rest.split('·')[0].trim() : null;
  const setsProgressPct = sets.length > 0 ? Math.min(100, (checkedSetsCount / sets.length) * 100) : 0;

  const firstDone = sets.find((s) => parseFloat(s.weight) > 0 || parseInt(s.reps, 10) > 0);
  const summaryLine = firstDone
    ? (parseFloat(firstDone.weight) > 0
        ? `${firstDone.weight} kg × ${firstDone.reps}${isTimedExercise ? 's' : ''}`
        : `${firstDone.reps}${isTimedExercise ? 's' : ' reps'}`)
    : null;

  const numberBadge = (size = 'w-9 h-9') => (
    <div
      className={`${size} rounded-xl flex items-center justify-center shrink-0 font-mono font-black text-sm border transition-colors ${
        isFullyCompleted
          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
          : isActive
            ? 'bg-viltrum-crimson text-white border-rose-400/40 shadow-md shadow-rose-950/60'
            : 'bg-white/[0.04] text-zinc-400 border-transparent'
      }`}
    >
      {isFullyCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : (index !== null ? index + 1 : <Target className="w-4 h-4" />)}
    </div>
  );

  // Collapsed compact row (completed or pending)
  if (isCollapsed) {
    return (
      <button
        type="button"
        className={`w-full text-left p-3.5 rounded-3xl border flex items-center justify-between gap-3 cursor-pointer transition-all select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-viltrum-crimson/60 ${
          isFullyCompleted
            ? 'bg-emerald-950/10 border-emerald-500/25 hover:bg-emerald-950/20'
            : 'bg-[#121217] border-white/[0.07] hover:bg-white/[0.02]'
        }`}
        onClick={() => onToggleCollapse && onToggleCollapse(exercise.id)}
        aria-expanded="false"
      >
        <div className="flex items-center gap-3 min-w-0">
          {numberBadge()}
          <div className="min-w-0">
            <h4 className={`text-sm font-bold truncate ${isFullyCompleted ? 'text-zinc-200' : 'text-white'}`}>
              {exercise.name}
            </h4>
            <p className="text-[11px] font-mono text-zinc-500 mt-0.5 truncate">
              {isFullyCompleted
                ? `${sets.length} series${summaryLine ? ` · ${summaryLine}` : ''}`
                : `${checkedSetsCount}/${sets.length} series · ${exercise.reps} reps`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {totalVolume > 0 && (
            <div className="text-right">
              <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 block">Volumen</span>
              <span className="text-xs font-mono font-bold text-white tabular-nums">
                {totalVolume.toLocaleString('es-ES')} kg
              </span>
            </div>
          )}
          <ChevronDown className="w-5 h-5 text-zinc-500" />
        </div>
      </button>
    );
  }

  return (
    <div
      className={`rounded-3xl border transition-all duration-300 relative overflow-hidden select-none p-4 ${
        isActive
          ? 'bg-gradient-to-b from-[#1a1015] to-[#0f0f13] border-viltrum-crimson/35 shadow-lg shadow-rose-950/30'
          : isFullyCompleted
            ? 'bg-[#0f1311] border-emerald-500/25'
            : 'bg-[#121217] border-white/[0.07] shadow-md'
      }`}
      onMouseEnter={() => onHover && onHover(exercise.id)}
      onClick={() => onClick && onClick(exercise.id)}
    >
      {/* Exercise Header */}
      <div className="flex items-start gap-3">
        {numberBadge('w-10 h-10')}

        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => onToggleCollapse && onToggleCollapse(exercise.id)}
        >
          <div className="flex items-center gap-1.5 flex-wrap">
            {exercise.isMainLift && (
              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-mono font-black uppercase tracking-wider bg-viltrum-crimson/20 text-rose-300 border border-viltrum-crimson/30">
                Principal
              </span>
            )}
            {isActive && !isFullyCompleted && (
              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-mono font-black uppercase tracking-wider bg-white/10 text-white border border-white/15">
                En curso
              </span>
            )}
          </div>
          <h4 className="text-lg font-bold tracking-tight text-white leading-snug mt-0.5">
            {exercise.name}
          </h4>

          {/* Meta chips */}
          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.04] text-[10px] font-mono font-bold text-zinc-300">
              <Flame className="w-3 h-3 text-rose-400" />
              {exercise.sets} × {exercise.reps}
            </span>
            {exercise.targetRir && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.04] text-[10px] font-mono font-bold text-zinc-300">
                RIR {exercise.targetRir}
              </span>
            )}
            {restLabel && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.04] text-[10px] font-mono font-bold text-zinc-300">
                <Timer className="w-3 h-3 text-zinc-400" />
                {restLabel}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse && onToggleCollapse(exercise.id);
          }}
          className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-zinc-400 hover:text-white flex items-center justify-center transition active:scale-95 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-viltrum-crimson/60"
          title="Contraer ejercicio"
          aria-label="Contraer ejercicio"
          aria-expanded="true"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>

      {/* Sets progress bar */}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1 h-1 rounded-full bg-white/[0.08] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isFullyCompleted ? 'bg-apple-green' : 'bg-viltrum-crimson'}`}
            style={{ width: `${setsProgressPct}%` }}
          />
        </div>
        <span className="text-[10px] font-mono font-bold text-zinc-500 tabular-nums">
          {checkedSetsCount}/{sets.length}
        </span>
      </div>

      {/* Body */}
      <div className="mt-4 space-y-3">
        {/* Technique Cue Note */}
        {exercise.notes && (
          <div className="p-3 rounded-2xl bg-amber-500/[0.05] border border-amber-500/15 text-xs text-zinc-300 leading-relaxed flex items-start gap-2.5">
            <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-amber-300 font-bold uppercase text-[10px] tracking-wider block font-mono mb-0.5">
                Técnica · palanca larga (191 cm)
              </strong>
              <span>{exercise.notes}</span>
            </div>
          </div>
        )}

        {/* Table Headers */}
        <div className={`${SET_GRID} text-[9px] font-mono uppercase tracking-wider text-zinc-500 px-2 font-bold`}>
          <div className="text-center">Set</div>
          <div className="text-center">Anterior</div>
          <div className="text-center">Peso</div>
          <div className="text-center">{isTimedExercise ? 'Seg' : 'Reps'}</div>
          <div className="text-center">RIR</div>
          <div />
        </div>

        {/* Sets Grid */}
        <div className="space-y-1.5">
          {sets.map((set, idx) => {
            const isChecked = !!set.checked;
            const isSuggested = !!set.isSuggested && !isChecked;

            // Previous history comparison & Progressive Overload Ghost
            const prevSet = previousHistory?.sets?.[idx] || null;
            const prevW = prevSet ? parseFloat(prevSet.weight) || 0 : null;
            const prevR = prevSet ? parseInt(prevSet.reps, 10) || 0 : null;
            const prevE1rm = prevW !== null && prevR !== null ? calcE1RM(prevW, prevR) : 0;

            const currW = parseFloat(set.weight) || 0;
            const currR = parseInt(set.reps, 10) || 0;
            const currE1rm = calcE1RM(currW, currR);

            const hasCurrentInput = currW > 0 || currR > 0;
            const hasPrevData = prevSet && (prevW > 0 || prevR > 0);

            let overloadBadge = null;
            let ghostPill = null;

            if (hasPrevData) {
              ghostPill = `${prevW > 0 ? `${prevW}×` : ''}${prevR}${isTimedExercise ? 's' : ''}`;
              if (hasCurrentInput) {
                if (isTimedExercise) {
                  const diffSecs = currR - prevR;
                  if (diffSecs > 0) {
                    overloadBadge = `+${diffSecs}s superado`;
                  } else if (diffSecs === 0) {
                    overloadBadge = `Igualado`;
                  }
                } else if (prevW > 0) {
                  const diff1rm = Math.round((currE1rm - prevE1rm) * 10) / 10;
                  if (diff1rm > 0) {
                    overloadBadge = `+${diff1rm} kg e1RM`;
                  } else if (diff1rm === 0) {
                    overloadBadge = `Igualado`;
                  }
                } else {
                  const diffR = currR - prevR;
                  if (diffR > 0) {
                    overloadBadge = `+${diffR} reps`;
                  }
                }
              }
            }

            const valueBtnClass = (hasValue) =>
              `w-full h-10 px-1 rounded-xl border text-center font-mono text-sm font-bold tabular-nums transition active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-viltrum-crimson/60 ${
                isChecked
                  ? 'bg-emerald-500/[0.06] border-emerald-500/20 text-emerald-100'
                  : isSuggested
                    ? 'bg-amber-500/[0.06] border-dashed border-amber-500/40 text-amber-200'
                    : hasValue
                      ? 'bg-black/50 border-zinc-800 text-white hover:border-zinc-700'
                      : 'bg-black/30 border-transparent text-zinc-600 hover:border-zinc-800'
              }`;

            return (
              <div key={idx}>
                <div
                  className={`${SET_GRID} p-1.5 rounded-2xl border transition-all ${
                    isChecked
                      ? 'bg-emerald-950/25 border-emerald-500/25'
                      : 'bg-[#141419] border-transparent'
                  }`}
                >
                  {/* Index */}
                  <div className="flex justify-center">
                    {isSuggested ? (
                      <span title="Sugerido de la serie anterior · toca ✓ para confirmar" className="w-6 h-6 rounded-full bg-amber-500/15 text-amber-300 flex items-center justify-center">
                        <Sparkles className="w-3 h-3" />
                      </span>
                    ) : (
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center font-mono font-bold text-[11px] ${
                        isChecked ? 'text-emerald-400' : 'text-zinc-400'
                      }`}>
                        {idx + 1}
                      </span>
                    )}
                  </div>

                  {/* Previous (Ghost) */}
                  <div className="text-center min-w-0">
                    {ghostPill ? (
                      <span className="font-mono text-[11px] font-semibold text-zinc-500 truncate block">
                        {ghostPill}
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono text-zinc-700">—</span>
                    )}
                  </div>

                  {/* Weight */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenPicker(idx, 'weight');
                    }}
                    className={valueBtnClass(!!set.weight)}
                    aria-label={`Peso serie ${idx + 1}`}
                  >
                    {set.weight ? set.weight : '—'}
                    {set.weight && <span className="text-[10px] font-semibold opacity-60 ml-0.5">kg</span>}
                  </button>

                  {/* Reps */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenPicker(idx, 'reps');
                    }}
                    className={valueBtnClass(!!set.reps)}
                    aria-label={`${isTimedExercise ? 'Segundos' : 'Repeticiones'} serie ${idx + 1}`}
                  >
                    {set.reps ? set.reps : '—'}
                    {set.reps && isTimedExercise && <span className="text-[10px] font-semibold opacity-60 ml-0.5">s</span>}
                  </button>

                  {/* RIR */}
                  <div className="relative">
                    <select
                      value={set.rir !== undefined ? set.rir : ''}
                      onChange={(e) => handleSetChange(idx, 'rir', e.target.value)}
                      aria-label={`RIR serie ${idx + 1}`}
                      className={`w-full h-10 appearance-none rounded-xl border text-center font-mono text-sm font-bold outline-none cursor-pointer transition focus-visible:ring-2 focus-visible:ring-viltrum-crimson/60 ${
                        set.rir !== undefined && set.rir !== ''
                          ? 'bg-black/50 border-zinc-800 text-zinc-200'
                          : 'bg-black/30 border-transparent text-zinc-600'
                      }`}
                      style={{ textAlignLast: 'center' }}
                    >
                      <option value="" className="bg-[#141419]">—</option>
                      <option value="0" className="bg-[#141419]">0</option>
                      <option value="1" className="bg-[#141419]">1</option>
                      <option value="2" className="bg-[#141419]">2</option>
                      <option value="3" className="bg-[#141419]">3</option>
                      <option value="4" className="bg-[#141419]">4+</option>
                    </select>
                  </div>

                  {/* Check */}
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => handleToggleCheck(idx)}
                      aria-label={isChecked ? `Desmarcar serie ${idx + 1}` : `Completar serie ${idx + 1}`}
                      aria-pressed={isChecked}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apple-green/60 ${
                        isChecked
                          ? 'bg-apple-green text-black shadow-md shadow-apple-green/30'
                          : isSuggested
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 hover:bg-amber-500/25'
                            : 'bg-white/[0.04] text-zinc-500 hover:text-white border border-transparent hover:bg-white/10'
                      }`}
                    >
                      <Check className="w-5 h-5 stroke-[3]" />
                    </button>
                  </div>
                </div>

                {/* Overload badge underneath if beaten */}
                {overloadBadge && (
                  <div className="flex justify-end pr-1 mt-1">
                    <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 font-mono text-[10px] font-bold inline-flex items-center gap-1">
                      <ArrowUpRight className="w-3 h-3" />
                      {overloadBadge}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Suggested legend */}
        {sets.some((s) => s.isSuggested && !s.checked) && (
          <p className="flex items-center gap-1.5 text-[10px] font-mono text-amber-400/90 px-1">
            <Sparkles className="w-3 h-3" />
            Valores sugeridos de la serie anterior · toca ✓ para confirmar
          </p>
        )}

        {/* Add & Remove Set Actions */}
        <div className="flex items-center gap-2 pt-1">
          {sets.length > 1 && (
            <button
              type="button"
              onClick={handleRemoveSet}
              className="h-10 px-3 rounded-xl bg-white/[0.02] hover:bg-rose-500/10 border border-transparent hover:border-rose-500/25 text-zinc-400 hover:text-rose-400 font-mono text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
              aria-label="Quitar última serie"
            >
              <Minus className="w-3.5 h-3.5" />
              <span>Quitar</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleAddSet}
            className="flex-1 h-10 rounded-xl border border-dashed border-zinc-800 hover:border-zinc-700 hover:bg-white/[0.02] text-zinc-400 hover:text-white font-mono text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Añadir serie</span>
          </button>
        </div>
      </div>

      {/* Number Wheel Picker (Cupertino wheel sheet, no keyboard) */}
      <NumberWheelPicker
        isOpen={pickerState.isOpen}
        onClose={() => setPickerState({ isOpen: false, setIndex: 0 })}
        exerciseName={exercise.name}
        setIndex={pickerState.setIndex}
        totalSets={sets.length}
        isTimed={isTimedExercise}
        targetReps={exercise.reps}
        targetRir={exercise.targetRir}
        initialWeight={sets[pickerState.setIndex]?.weight || ''}
        initialReps={sets[pickerState.setIndex]?.reps || ''}
        initialRir={sets[pickerState.setIndex]?.rir !== undefined ? sets[pickerState.setIndex]?.rir : ''}
        initialTab={pickerState.initialTab}
        previousSet={pickerState.setIndex > 0 ? sets[pickerState.setIndex - 1] : previousHistory?.sets?.[0] || null}
        previousHistory={previousHistory}
        onSave={handleSaveFromWheel}
        onSaveAndNext={handleSaveAndNext}
      />
    </div>
  );
}
