import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, RotateCcw, Copy, Sparkles, Plus, Minus, Delete, ArrowRight, Target, Flame } from 'lucide-react';
import { getWeightIncrement, triggerSafeVibrate } from '../utils/preferences';

const calcE1RM = (weight, reps) => {
  const w = parseFloat(weight) || 0;
  const r = parseInt(reps, 10) || 0;
  if (w <= 0 || r <= 0) return 0;
  if (r === 1) return w;
  return Math.round(w * (1 + r / 30) * 10) / 10;
};

const STANDARD_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
const calculatePlatesPerSide = (totalWeight, barWeight = 20) => {
  const w = parseFloat(totalWeight) || 0;
  if (w < barWeight) return null;
  let remaining = Math.round(((w - barWeight) / 2) * 100) / 100;
  const plates = [];
  for (const p of STANDARD_PLATES) {
    while (remaining >= p - 0.001) {
      plates.push(p);
      remaining = Math.round((remaining - p) * 100) / 100;
    }
  }
  return { plates, remainder: remaining };
};

export default function NumberWheelPicker({
  isOpen,
  onClose,
  exerciseName = '',
  setIndex = 0,
  totalSets = 3,
  isTimed = false,
  targetReps = '',
  targetRir = '',
  initialWeight = '',
  initialReps = '',
  initialRir = '',
  initialTab = 'weight',
  previousSet = null,
  previousHistory = null,
  onSave,
  onSaveAndNext,
}) {
  // Detect if exercise is isometric/timed
  const isIsometricExercise =
    isTimed ||
    exerciseName.toLowerCase().includes('plancha') ||
    exerciseName.toLowerCase().includes('hang') ||
    targetReps.toString().toLowerCase().includes('s');

  // 'weight' | 'reps'
  const [activeField, setActiveField] = useState('weight');
  const [weightStr, setWeightStr] = useState('0');
  const [repsStr, setRepsStr] = useState('10');
  const [rir, setRir] = useState(2);
  const [hasEditedCurrentField, setHasEditedCurrentField] = useState(false);

  // Touch Swipe-to-Dismiss State
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartY = useRef(0);
  const currentDragY = useRef(0);

  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
    currentDragY.current = 0;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY.current;
    if (diff > 0) {
      currentDragY.current = diff;
      setDragY(diff);
    } else {
      currentDragY.current = 0;
      setDragY(0);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (currentDragY.current > 70) {
      setDragY(450);
      setTimeout(() => {
        setDragY(0);
        currentDragY.current = 0;
        onClose();
      }, 160);
    } else {
      setDragY(0);
      currentDragY.current = 0;
    }
  };

  // Sync state on modal open
  useEffect(() => {
    if (!isOpen) return;
    setDragY(0);
    currentDragY.current = 0;
    setIsDragging(false);

    // Weight
    let wVal = initialWeight;
    if ((!wVal || parseFloat(wVal) === 0) && previousSet?.weight !== undefined) {
      wVal = previousSet.weight;
    }
    if ((!wVal || parseFloat(wVal) === 0) && previousHistory?.sets?.[setIndex]?.weight !== undefined) {
      wVal = previousHistory.sets[setIndex].weight;
    }
    const safeW = parseFloat(wVal);
    setWeightStr(!isNaN(safeW) && safeW > 0 ? safeW.toString() : '0');

    // Reps / Time
    let rVal = initialReps;
    if ((!rVal || parseInt(rVal, 10) === 0) && previousSet?.reps !== undefined) {
      rVal = previousSet.reps;
    }
    if ((!rVal || parseInt(rVal, 10) === 0) && previousHistory?.sets?.[setIndex]?.reps !== undefined) {
      rVal = previousHistory.sets[setIndex].reps;
    }
    const safeR = parseInt(rVal, 10);
    if (!isNaN(safeR) && safeR > 0) {
      setRepsStr(safeR.toString());
    } else {
      setRepsStr(isIsometricExercise ? '45' : '10');
    }

    // RIR
    let initialRirVal = parseInt(initialRir, 10);
    if (isNaN(initialRirVal)) {
      initialRirVal = targetRir ? parseInt(targetRir, 10) : 2;
    }
    setRir(isNaN(initialRirVal) ? 2 : Math.max(0, Math.min(4, initialRirVal)));

    // Default focus based on initialTab clicked or isometric
    if (isIsometricExercise) {
      setActiveField('reps');
    } else if (initialTab) {
      setActiveField(initialTab);
    } else {
      setActiveField('weight');
    }
    setHasEditedCurrentField(false);
  }, [isOpen, initialWeight, initialReps, initialRir, initialTab, setIndex, isIsometricExercise]);

  const weightStep = getWeightIncrement();

  const triggerHaptic = () => {
    triggerSafeVibrate(10);
  };

  // Adjust numbers using Stepper buttons (+/-)
  const adjustValue = (delta) => {
    triggerHaptic();
    if (activeField === 'weight') {
      const current = parseFloat(weightStr) || 0;
      const next = Math.max(0, Math.min(300, Number((current + delta).toFixed(2))));
      setWeightStr(next.toString());
    } else {
      const current = parseInt(repsStr, 10) || 0;
      const step = isIsometricExercise ? (delta > 0 ? 5 : -5) : delta;
      const next = Math.max(1, Math.min(300, current + step));
      setRepsStr(next.toString());
    }
  };

  // Keypad button press
  const handleKeypadPress = (val) => {
    triggerHaptic();
    const isWeight = activeField === 'weight';
    const currentVal = isWeight ? weightStr : repsStr;

    // Backspace
    if (val === 'backspace') {
      if (currentVal.length <= 1) {
        if (isWeight) setWeightStr('0');
        else setRepsStr(isIsometricExercise ? '0' : '1');
      } else {
        const next = currentVal.slice(0, -1);
        if (isWeight) setWeightStr(next);
        else setRepsStr(next);
      }
      return;
    }

    // Decimal point (only allowed for weight)
    if (val === '.') {
      if (!isWeight) return; // Reps/Time don't have decimals
      if (currentVal.includes('.')) return;
      if (!hasEditedCurrentField) {
        setWeightStr('0.');
        setHasEditedCurrentField(true);
      } else {
        setWeightStr(currentVal + '.');
      }
      return;
    }

    // Numbers (0-9)
    if (!hasEditedCurrentField) {
      // First keypress replaces current default value
      if (isWeight) setWeightStr(val);
      else setRepsStr(val);
      setHasEditedCurrentField(true);
    } else {
      // Avoid excessive length
      if (currentVal.length >= 6) return;
      if (currentVal === '0' && val !== '.') {
        if (isWeight) setWeightStr(val);
        else setRepsStr(val);
      } else {
        if (isWeight) setWeightStr(currentVal + val);
        else setRepsStr(currentVal + val);
      }
    }
  };

  // Quick preset button click (e.g. plate chip or frequent reps)
  const applyPreset = (val) => {
    triggerHaptic();
    if (activeField === 'weight') {
      setWeightStr(val.toString());
    } else {
      setRepsStr(val.toString());
    }
    setHasEditedCurrentField(true);
  };

  // Quick reset / copy previous session or previous set
  const handleCopyPrevious = () => {
    triggerHaptic();
    if (previousSet && (previousSet.weight || previousSet.reps)) {
      setWeightStr(previousSet.weight ? previousSet.weight.toString() : '0');
      setRepsStr(previousSet.reps ? previousSet.reps.toString() : '10');
      if (previousSet.rir !== undefined && previousSet.rir !== null) {
        setRir(parseInt(previousSet.rir, 10) || 2);
      }
      return;
    }
    if (previousHistory?.sets?.[setIndex]) {
      const hist = previousHistory.sets[setIndex];
      setWeightStr(hist.weight ? hist.weight.toString() : '0');
      setRepsStr(hist.reps ? hist.reps.toString() : '10');
      if (hist.rir !== undefined && hist.rir !== null) {
        setRir(parseInt(hist.rir, 10) || 2);
      }
    }
  };

  const handleConfirm = () => {
    triggerHaptic();
    const finalWeight = parseFloat(weightStr) || 0;
    const finalReps = parseInt(repsStr, 10) || (isIsometricExercise ? 45 : 10);

    onSave({
      weight: finalWeight > 0 ? finalWeight.toString() : '0',
      reps: finalReps.toString(),
      rir: rir !== null ? rir.toString() : '2',
      isTimed: isIsometricExercise,
    });
    onClose();
  };

  const handleConfirmAndNext = () => {
    triggerHaptic();
    const finalWeight = parseFloat(weightStr) || 0;
    const finalReps = parseInt(repsStr, 10) || (isIsometricExercise ? 45 : 10);

    if (onSaveAndNext) {
      onSaveAndNext({
        weight: finalWeight > 0 ? finalWeight.toString() : '0',
        reps: finalReps.toString(),
        rir: rir !== null ? rir.toString() : '2',
        isTimed: isIsometricExercise,
      });
    } else {
      handleConfirm();
    }
  };

  if (!isOpen) return null;

  const currentWeightNum = parseFloat(weightStr) || 0;
  const currentRepsNum = parseInt(repsStr, 10) || 0;

  const rirDescriptions = {
    0: 'RIR 0 (Fallo absoluto)',
    1: 'RIR 1 (1 rep en recámara)',
    2: 'RIR 2 (Óptimo hipertrofia)',
    3: 'RIR 3 (Intensidad moderada)',
    4: 'RIR 4+ (Calentamiento)',
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in-backdrop select-none"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-[#121217] border-t sm:border border-white/12 rounded-t-[32px] sm:rounded-[32px] shadow-2xl p-4 sm:p-5 max-h-[92vh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] relative select-none will-change-transform"
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Top Handle Pill & Touch Drag Area */}
        <div
          className="w-full pt-0.5 pb-2 cursor-grab active:cursor-grabbing flex flex-col items-center justify-center touch-none select-none -mt-1"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-12 h-1.5 bg-white/30 hover:bg-white/50 active:bg-white/70 rounded-full mx-auto transition" />
          <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mt-1">
            Desliza hacia abajo para cerrar
          </span>
        </div>

        {/* Top Action Header: [Close] Title [Copy Previa] [Checkmark] */}
        <div
          className="flex items-center justify-between pb-2 mb-2 relative z-10 border-b border-white/8 touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/8 hover:bg-white/15 active:scale-90 flex items-center justify-center text-zinc-300 hover:text-white transition"
            title="Cerrar"
          >
            <ChevronDown className="w-5 h-5 stroke-[2.5]" />
          </button>

          <div className="text-center px-2 flex-1 truncate">
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-viltrum-crimson px-2 py-0.5 rounded-full bg-viltrum-crimson/15 border border-viltrum-crimson/30">
                Serie #{setIndex + 1} de {totalSets}
              </span>
              {isIsometricExercise && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Isométrico
                </span>
              )}
            </div>
            <span className="text-xs font-semibold text-white truncate block mt-0.5 max-w-[200px] sm:max-w-[240px] mx-auto">
              {exerciseName}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCopyPrevious}
              className="w-9 h-9 rounded-full bg-white/8 hover:bg-white/15 active:scale-90 flex items-center justify-center text-zinc-300 hover:text-white transition"
              title="Copiar serie previa / deshacer"
            >
              <RotateCcw className="w-4 h-4 stroke-[2.5]" />
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              className="w-10 h-10 rounded-full bg-red-600 hover:bg-red-500 active:scale-90 flex items-center justify-center text-white shadow-lg shadow-red-950/80 transition"
              title="Confirmar serie"
            >
              <Check className="w-5 h-5 stroke-[3]" />
            </button>
          </div>
        </div>

        {/* Previous Reference & Progressive Overload Target Header */}
        {(() => {
          const histSet = previousHistory?.sets?.[setIndex] || null;
          const histW = histSet ? parseFloat(histSet.weight) || 0 : null;
          const histR = histSet ? parseInt(histSet.reps, 10) || 0 : null;
          const hasHist = histW !== null && histR !== null && (histW > 0 || histR > 0);

          const currentW = parseFloat(weightStr) || 0;
          const currentR = parseInt(repsStr, 10) || 0;
          const currE1rm = calcE1RM(currentW, currentR);
          const histE1rm = hasHist ? calcE1RM(histW, histR) : 0;

          const isOverloadBeaten = hasHist && (
            isIsometricExercise
              ? (currentR > histR || (currentR === histR && currentW > histW))
              : histW > 0
              ? currE1rm > histE1rm
              : currentR > histR
          );

          if (!hasHist && !previousSet) return null;

          return (
            <div className="mb-2.5 p-2 rounded-2xl bg-white/[0.03] border border-white/8 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-400 flex items-center gap-1.5 text-[11px]">
                  <Target className="w-3.5 h-3.5 text-amber-400" />
                  <span>Meta semana previa:</span>
                </span>
                <span className="text-white font-bold text-[12px]">
                  {hasHist
                    ? `${histR}${isIsometricExercise ? 's' : 'r'} × ${histW} kg`
                    : `${previousSet.reps}${isIsometricExercise ? 's' : 'r'} × ${previousSet.weight} kg`}
                </span>
              </div>

              {/* Quick Overload Beat Target Buttons */}
              {hasHist && (
                <div className="flex items-center gap-1.5 pt-1 border-t border-white/5">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider shrink-0">
                    Superar:
                  </span>
                  {!isIsometricExercise ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic();
                          setWeightStr(histW.toString());
                          setRepsStr((histR + 1).toString());
                          setActiveField('reps');
                          setHasEditedCurrentField(true);
                        }}
                        className="flex-1 py-1 px-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 active:scale-95 text-amber-300 font-mono text-[11px] font-semibold border border-amber-500/25 flex items-center justify-center gap-1 transition"
                      >
                        <span>+1 Rep ({histR + 1})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic();
                          setWeightStr(Number((histW + weightStep).toFixed(2)).toString());
                          setRepsStr(histR.toString());
                          setActiveField('weight');
                          setHasEditedCurrentField(true);
                        }}
                        className="flex-1 py-1 px-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 active:scale-95 text-amber-300 font-mono text-[11px] font-semibold border border-amber-500/25 flex items-center justify-center gap-1 transition"
                      >
                        <span>+{weightStep}kg ({Number((histW + weightStep).toFixed(2))})</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        setRepsStr((histR + 5).toString());
                        setActiveField('reps');
                        setHasEditedCurrentField(true);
                      }}
                      className="flex-1 py-1 px-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 active:scale-95 text-amber-300 font-mono text-[11px] font-semibold border border-amber-500/25 flex items-center justify-center gap-1 transition"
                    >
                      <span>+5 Segundos ({histR + 5}s)</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCopyPrevious}
                    className="p-1 px-2 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-zinc-400 font-mono text-[10px] border border-white/5 transition"
                    title="Igualar marca exacta"
                  >
                    Igualar
                  </button>
                </div>
              )}

              {/* Live Overload celebration cue */}
              {isOverloadBeaten && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono font-bold animate-pulse">
                  <Flame className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>
                    ¡Superando la marca previa
                    {!isIsometricExercise && histW > 0
                      ? ` (+${Math.round((currE1rm - histE1rm) * 10) / 10}kg 1RM)`
                      : ` (+${currentR - histR}${isIsometricExercise ? 's' : 'r'})`}
                    !
                  </span>
                </div>
              )}
            </div>
          );
        })()}

        {/* DUAL DISPLAY CARDS: PESO & REPS/TIEMPO (Tap to focus) */}
        <div className="grid grid-cols-2 gap-2 mb-2.5">
          {/* WEIGHT CARD */}
          <button
            type="button"
            onClick={() => {
              setActiveField('weight');
              setHasEditedCurrentField(false);
              triggerHaptic();
            }}
            className={`p-3 rounded-2xl border transition-all text-center relative overflow-hidden active:scale-98 ${
              activeField === 'weight'
                ? 'bg-rose-500/15 border-rose-500 text-white shadow-lg shadow-rose-950/60 ring-2 ring-rose-500/40'
                : 'bg-white/[0.04] border-white/8 text-zinc-400 hover:text-white'
            }`}
          >
            <span className="text-[10px] font-mono uppercase tracking-widest block text-zinc-400 mb-0.5">
              {isIsometricExercise ? 'Lastre Añadido' : 'Peso en Barra/Manc.'}
            </span>
            <div className="font-mono text-2xl sm:text-3xl font-black text-white flex items-baseline justify-center gap-1">
              <span>{weightStr}</span>
              <span className="text-xs font-bold text-zinc-400 uppercase">kg</span>
            </div>
            {activeField === 'weight' && (
              <div className="w-10 h-1 bg-rose-500 rounded-full mx-auto mt-1" />
            )}
          </button>

          {/* REPS / TIME CARD */}
          <button
            type="button"
            onClick={() => {
              setActiveField('reps');
              setHasEditedCurrentField(false);
              triggerHaptic();
            }}
            className={`p-3 rounded-2xl border transition-all text-center relative overflow-hidden active:scale-98 ${
              activeField === 'reps'
                ? 'bg-blue-500/15 border-blue-500 text-white shadow-lg shadow-blue-950/60 ring-2 ring-blue-500/40'
                : 'bg-white/[0.04] border-white/8 text-zinc-400 hover:text-white'
            }`}
          >
            <span className="text-[10px] font-mono uppercase tracking-widest block text-zinc-400 mb-0.5">
              {isIsometricExercise ? 'Tiempo Isométrico' : 'Repeticiones'}
            </span>
            <div className="font-mono text-2xl sm:text-3xl font-black text-white flex items-baseline justify-center gap-1">
              <span>{repsStr}</span>
              <span className="text-xs font-bold text-zinc-400 uppercase">
                {isIsometricExercise ? 'seg' : 'reps'}
              </span>
            </div>
            {activeField === 'reps' && (
              <div className="w-10 h-1 bg-blue-500 rounded-full mx-auto mt-1" />
            )}
          </button>
        </div>

        {/* PLATE CALCULATOR STRIP (Barra 20kg · discos por lado) */}
        {activeField === 'weight' && !isIsometricExercise && currentWeightNum >= 20 && (() => {
          const calc = calculatePlatesPerSide(currentWeightNum, 20);
          if (!calc) return null;
          return (
            <div className="mb-2.5 px-3 py-1.5 rounded-2xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
              <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                Barra 20kg · /lado:
              </span>
              {calc.plates.length === 0 ? (
                <span className="text-[10px] font-mono font-bold text-zinc-300">Solo barra</span>
              ) : (
                <div className="flex items-center gap-1 shrink-0">
                  {calc.plates.map((p, i) => (
                    <span
                      key={`${p}-${i}`}
                      className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] font-black border ${
                        p >= 20
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/35'
                          : p >= 10
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/35'
                            : p >= 5
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/35'
                              : 'bg-white/10 text-zinc-200 border-white/15'
                      }`}
                    >
                      {p}
                    </span>
                  ))}
                  {calc.remainder > 0 && (
                    <span className="text-[9px] font-mono text-zinc-500">+{calc.remainder}</span>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* QUICK STEPPERS ROW & PRESETS (Hevy Style Direct Chips) */}
        <div className="mb-2.5 space-y-1.5">
          {activeField === 'weight' ? (
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
              <button
                type="button"
                onClick={() => adjustValue(-weightStep)}
                className="py-1.5 px-3 rounded-xl bg-white/8 hover:bg-white/12 active:scale-90 text-zinc-300 font-mono text-xs font-bold border border-white/8 shrink-0 flex items-center gap-0.5"
              >
                <Minus className="w-3 h-3" /> {weightStep}k
              </button>
              {[-10, -5, 1.25, 2.5, 5, 10, 20].map((delta) => (
                <button
                  key={`w-plate-${delta}`}
                  type="button"
                  onClick={() => adjustValue(delta)}
                  className={`py-1.5 px-2.5 rounded-xl font-mono text-xs font-bold transition active:scale-90 border shrink-0 ${
                    delta > 0
                      ? 'bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25'
                      : 'bg-white/5 text-zinc-400 border-white/8 hover:bg-white/10'
                  }`}
                >
                  {delta > 0 ? `+${delta}` : delta}
                </button>
              ))}
              <button
                type="button"
                onClick={() => adjustValue(weightStep)}
                className="py-1.5 px-3 rounded-xl bg-rose-500/20 text-rose-300 active:scale-90 font-mono text-xs font-bold border border-rose-500/40 shrink-0 flex items-center gap-0.5"
              >
                <Plus className="w-3 h-3" /> {weightStep}k
              </button>
            </div>
          ) : isIsometricExercise ? (
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
              <button
                type="button"
                onClick={() => adjustValue(-5)}
                className="py-1.5 px-3 rounded-xl bg-white/8 active:scale-90 text-zinc-300 font-mono text-xs font-bold border border-white/8 shrink-0 flex items-center gap-0.5"
              >
                <Minus className="w-3 h-3" /> 5s
              </button>
              {[20, 30, 45, 60, 90, 120].map((sec) => (
                <button
                  key={`time-chip-${sec}`}
                  type="button"
                  onClick={() => applyPreset(sec)}
                  className={`py-1.5 px-2.5 rounded-xl font-mono text-xs font-bold transition active:scale-90 border shrink-0 ${
                    parseInt(repsStr, 10) === sec
                      ? 'bg-amber-500/30 text-amber-300 border-amber-500 shadow-sm'
                      : 'bg-white/5 text-zinc-400 border-white/8 hover:bg-white/10'
                  }`}
                >
                  {sec}s
                </button>
              ))}
              <button
                type="button"
                onClick={() => adjustValue(5)}
                className="py-1.5 px-3 rounded-xl bg-amber-500/20 text-amber-300 active:scale-90 font-mono text-xs font-bold border border-amber-500/40 shrink-0 flex items-center gap-0.5"
              >
                <Plus className="w-3 h-3" /> 5s
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
              <button
                type="button"
                onClick={() => adjustValue(-1)}
                className="py-1.5 px-3 rounded-xl bg-white/8 active:scale-90 text-zinc-300 font-mono text-xs font-bold border border-white/8 shrink-0 flex items-center gap-0.5"
              >
                <Minus className="w-3 h-3" /> 1
              </button>
              {[5, 6, 8, 10, 12, 15, 20].map((rVal) => (
                <button
                  key={`r-chip-${rVal}`}
                  type="button"
                  onClick={() => applyPreset(rVal)}
                  className={`py-1.5 px-2.5 rounded-xl font-mono text-xs font-bold transition active:scale-90 border shrink-0 ${
                    parseInt(repsStr, 10) === rVal
                      ? 'bg-blue-500/30 text-blue-300 border-blue-500 shadow-sm'
                      : 'bg-white/5 text-zinc-400 border-white/8 hover:bg-white/10'
                  }`}
                >
                  {rVal}
                </button>
              ))}
              <button
                type="button"
                onClick={() => adjustValue(1)}
                className="py-1.5 px-3 rounded-xl bg-blue-500/20 text-blue-300 active:scale-90 font-mono text-xs font-bold border border-blue-500/40 shrink-0 flex items-center gap-0.5"
              >
                <Plus className="w-3 h-3" /> 1
              </button>
            </div>
          )}
        </div>

        {/* HIGH-PERFORMANCE IN-APP NUMPAD (Zero iOS keyboard jumps, huge tap targets) */}
        <div className="bg-[#09090c] border border-white/10 rounded-2xl p-2 mb-2.5 shadow-inner">
          <div className="grid grid-cols-3 gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
              <button
                key={`digit-${digit}`}
                type="button"
                onClick={() => handleKeypadPress(digit.toString())}
                className="h-10.5 sm:h-11 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] active:bg-white/[0.22] text-white font-mono text-lg font-bold transition active:scale-95 border border-white/5 flex items-center justify-center shadow-sm"
              >
                {digit}
              </button>
            ))}

            {/* Decimal / Dot (Only active for weight) */}
            <button
              type="button"
              onClick={() => handleKeypadPress('.')}
              disabled={activeField !== 'weight'}
              className="h-10.5 sm:h-11 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] active:bg-white/[0.22] text-white font-mono text-xl font-black transition active:scale-95 border border-white/5 disabled:opacity-20 flex items-center justify-center"
            >
              .
            </button>

            {/* Zero */}
            <button
              type="button"
              onClick={() => handleKeypadPress('0')}
              className="h-10.5 sm:h-11 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] active:bg-white/[0.22] text-white font-mono text-lg font-bold transition active:scale-95 border border-white/5 flex items-center justify-center"
            >
              0
            </button>

            {/* Backspace */}
            <button
              type="button"
              onClick={() => handleKeypadPress('backspace')}
              className="h-10.5 sm:h-11 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 active:bg-rose-500/35 text-rose-300 font-mono text-sm font-bold transition active:scale-95 border border-rose-500/25 flex items-center justify-center gap-1"
              aria-label="Borrar"
            >
              <Delete className="w-5 h-5 stroke-[2.2]" />
            </button>
          </div>
        </div>

        {/* RIR Selection Segmented Row */}
        <div className="p-2 bg-white/[0.03] border border-white/6 rounded-2xl mb-2.5">
          <div className="flex items-center justify-between mb-1.5 px-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
              RIR (Repeticiones en Reserva):
            </span>
            <span className="text-[11px] font-mono text-purple-300 font-semibold">
              {rirDescriptions[rir]}
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1">
            {[0, 1, 2, 3, 4].map((rVal) => (
              <button
                key={`rir-${rVal}`}
                type="button"
                onClick={() => {
                  setRir(rVal);
                  triggerHaptic();
                }}
                className={`py-1.5 rounded-xl text-xs font-mono font-bold transition active:scale-90 border ${
                  rir === rVal
                    ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-900/50 ring-1 ring-purple-300/40'
                    : 'bg-white/5 text-zinc-400 hover:text-white border-white/5'
                }`}
              >
                {rVal === 4 ? '4+' : rVal}
              </button>
            ))}
          </div>
        </div>

        {/* BOTTOM CONFIRM BUTTONS */}
        <div className="flex items-center gap-2">
          {setIndex < totalSets - 1 && onSaveAndNext ? (
            <>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 active:scale-98 text-white font-semibold text-xs sm:text-sm transition"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={handleConfirmAndNext}
                className="flex-[1.4] py-3.5 rounded-2xl bg-red-600 hover:bg-red-500 active:scale-98 text-white font-bold text-xs sm:text-sm transition shadow-lg shadow-red-950/80 flex items-center justify-center gap-1.5"
              >
                <span>Guardar y Siguiente</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleConfirm}
              className="w-full py-3.5 rounded-2xl bg-red-600 hover:bg-red-500 active:scale-98 text-white font-bold text-sm transition shadow-lg shadow-red-950/80 flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>
                {isIsometricExercise
                  ? `Guardar Serie #${setIndex + 1} (${repsStr}s · ${currentWeightNum > 0 ? `+${currentWeightNum}kg` : 'sin lastre'})`
                  : `Guardar Serie #${setIndex + 1} (${repsStr} reps · ${currentWeightNum} kg)`}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
