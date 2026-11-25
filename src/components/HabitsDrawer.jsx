import React, { useState, useEffect, useRef } from 'react';
import { X, Droplets, Zap, Moon, Leaf, Plus, Minus, Check, Sparkles, HeartPulse, Sun, Activity, Flame } from 'lucide-react';

export default function HabitsDrawer({
  isOpen,
  onClose,
  habit = {},
  onChange,
  onSave,
  saving = false,
  currentDate = ''
}) {
  const [caloriesInput, setCaloriesInput] = useState(habit.calories ?? '');
  const caloriesDebounceRef = useRef(null);

  useEffect(() => {
    setCaloriesInput(habit.calories ?? '');
  }, [habit.calories, currentDate]);

  useEffect(() => {
    return () => {
      if (caloriesDebounceRef.current) clearTimeout(caloriesDebounceRef.current);
    };
  }, []);

  if (!isOpen) return null;

  // Hydration values (Goal: 3.5 L)
  const WATER_GOAL = 3.5;
  const currentWater = parseFloat(habit.water) || 0;
  const waterPercent = Math.min(100, Math.round((currentWater / WATER_GOAL) * 100));
  const waterRemaining = Math.max(0, Number((WATER_GOAL - currentWater).toFixed(2)));

  // Protein values (Goal: 170 g - Rutina Thragg)
  const PROTEIN_GOAL = 170;
  const currentProtein = parseInt(habit.protein, 10) || 0;
  const proteinPercent = Math.min(100, Math.round((currentProtein / PROTEIN_GOAL) * 100));

  // Calories values (Goal: 3100 kcal)
  const CALORIES_GOAL = 3100;
  const currentCalories = parseInt(habit.calories, 10) || 0;
  const caloriesPercent = Math.min(100, Math.round((currentCalories / CALORIES_GOAL) * 100));

  // Sleep & Creatine
  const sleepCompleted = parseFloat(habit.sleepHours) >= 7.5;
  const creatineCompleted = !!habit.creatine;

  const updateHabit = (patch) => {
    const updated = { ...habit, ...patch, updatedAt: new Date().toISOString() };
    onChange(updated);
    if (onSave) onSave(updated);
  };

  const handleAddWater = (liters) => {
    const next = Math.max(0, Number((currentWater + liters).toFixed(2)));
    updateHabit({ water: next });
  };

  const handleAddProtein = (grams) => {
    const next = Math.max(0, currentProtein + grams);
    updateHabit({ protein: next });
  };

  const handleToggleSleep = () => {
    const next = sleepCompleted ? 6 : 8;
    updateHabit({ sleepHours: next });
  };

  const handleToggleCreatine = () => {
    updateHabit({ creatine: !creatineCompleted });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/85 backdrop-blur-md animate-fade-in-backdrop select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#0e0e12] border-t border-white/[0.1] rounded-t-[36px] shadow-2xl p-5 sm:p-6 max-h-[92vh] overflow-y-auto ios-sheet-transition pb-[calc(env(safe-area-inset-bottom,0px)+2.5rem)] text-white relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Handle Pill */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold tracking-widest text-zinc-400 uppercase">
                HOY · {currentDate || 'REGISTRO DIARIO'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {saving ? 'Guardando...' : 'Autoguardado activo'}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-0.5">
              Hábitos diarios
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Agua, nutrición y descanso guardados automáticamente.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/8 hover:bg-white/15 active:scale-90 flex items-center justify-center text-zinc-400 hover:text-white transition"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        <div className="space-y-3.5">
          {/* ========================================================= */}
          {/* CARD 1: AGUA / HIDRATACIÓN                                */}
          {/* ========================================================= */}
          <div className="p-4 sm:p-5 rounded-3xl bg-[#141419] border border-transparent relative overflow-hidden shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Droplets className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold block">
                    AGUA
                  </span>
                  <span className="text-sm font-bold text-white">
                    Hidratación Celular
                  </span>
                </div>
              </div>
              <span className="text-xs font-mono text-zinc-400 font-semibold">
                Meta {WATER_GOAL} L
              </span>
            </div>

            {/* Circular Gauge / Status Display */}
            <div className="flex items-center gap-4 py-2">
              <div className="relative w-24 h-24 rounded-full border-4 border-blue-500/20 bg-blue-950/30 flex flex-col items-center justify-center shrink-0 overflow-hidden shadow-inner">
                {/* Wave simulation */}
                <div
                  className="absolute bottom-0 left-0 right-0 bg-blue-500/30 transition-all duration-500"
                  style={{ height: `${waterPercent}%` }}
                />
                <span className="text-xl font-mono font-black text-white relative z-10">
                  {currentWater}
                </span>
                <span className="text-[10px] font-mono text-blue-300 relative z-10 font-medium">
                  / {WATER_GOAL} L
                </span>
              </div>

              <div className="flex-1">
                <div className="text-sm font-bold text-blue-400">
                  {waterPercent}% completado
                </div>
                <div className="text-xs text-zinc-400 mt-0.5 font-mono">
                  {waterRemaining > 0 ? `${waterRemaining} L restantes` : '¡Objetivo diario alcanzado!'}
                </div>
                {/* Undo small button */}
                {currentWater > 0 && (
                  <button
                    type="button"
                    onClick={() => handleAddWater(-0.25)}
                    className="mt-2 text-[10px] font-mono text-zinc-500 hover:text-rose-400 underline block"
                  >
                    Deshacer (-250ml)
                  </button>
                )}
              </div>
            </div>

            {/* Quick Accumulator Buttons */}
            <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-transparent">
              {[
                { label: '+ 250ml', value: 0.25 },
                { label: '+ 500ml', value: 0.5 },
                { label: '+ 750ml', value: 0.75 },
                { label: '+ 1.0L', value: 1.0 },
              ].map((btn) => (
                <button
                  key={btn.label}
                  type="button"
                  onClick={() => handleAddWater(btn.value)}
                  className="py-2.5 px-1 rounded-2xl bg-white/[0.05] hover:bg-blue-500/20 active:scale-95 text-blue-300 font-mono text-xs font-bold border border-transparent hover:border-blue-500/40 transition flex items-center justify-center shadow-sm"
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* ========================================================= */}
          {/* CARD 2: PROTEÍNA / OBJETIVO DIARIO                        */}
          {/* ========================================================= */}
          <div className="p-4 sm:p-5 rounded-3xl bg-[#141419] border border-transparent relative overflow-hidden shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <Zap className="w-5 h-5 fill-rose-500/40" />
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold block">
                    PROTEÍNA
                  </span>
                  <span className="text-sm font-bold text-white">
                    Síntesis Proteica
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-lg font-mono font-black text-white">
                  {currentProtein}
                </span>
                <span className="text-xs font-mono text-zinc-400 font-semibold">
                  / {PROTEIN_GOAL}g
                </span>
                {currentProtein > 0 && (
                  <button
                    type="button"
                    onClick={() => handleAddProtein(-10)}
                    className="block ml-auto text-[10px] font-mono text-zinc-500 hover:text-rose-400 underline mt-0.5"
                  >
                    Deshacer (-10g)
                  </button>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden my-3">
              <div
                className="h-full bg-gradient-to-r from-rose-500 to-red-400 rounded-full transition-all duration-500"
                style={{ width: `${proteinPercent}%` }}
              />
            </div>

            {/* Quick Protein Buttons */}
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                type="button"
                onClick={() => handleAddProtein(25)}
                className="py-2.5 px-3 rounded-2xl bg-white/[0.05] hover:bg-rose-500/15 active:scale-95 text-white font-mono text-xs font-semibold border border-transparent hover:border-rose-500/30 transition flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-zinc-400 uppercase text-[10px]">SCOOP</span>
                <span className="font-bold text-rose-300">+25g</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddProtein(40)}
                className="py-2.5 px-3 rounded-2xl bg-white/[0.05] hover:bg-rose-500/15 active:scale-95 text-white font-mono text-xs font-semibold border border-transparent hover:border-rose-500/30 transition flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-zinc-400 uppercase text-[10px]">COMIDA</span>
                <span className="font-bold text-rose-300">+40g</span>
              </button>
            </div>
          </div>

          {/* ========================================================= */}
          {/* CARD 3: CALORÍAS · SUPERÁVIT LIMPIO 3.100 KCAL            */}
          {/* ========================================================= */}
          <div className="p-4 sm:p-5 rounded-3xl bg-[#141419] border border-transparent space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold block">
                    SUPERÁVIT CAMARERO
                  </span>
                  <span className="text-sm font-bold text-white">
                    Calorías Diarias
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-lg font-mono font-black text-white">
                  {currentCalories}
                </span>
                <span className="text-xs font-mono text-zinc-400 font-semibold">
                  / {CALORIES_GOAL} kcal
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all duration-500"
                style={{ width: `${caloriesPercent}%` }}
              />
            </div>

            {/* Quick Calories Accumulators */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={() => updateHabit({ calories: currentCalories + 250 })}
                className="py-2.5 rounded-2xl bg-white/[0.04] hover:bg-orange-500/15 border border-transparent hover:border-orange-500/30 font-mono text-xs font-bold text-zinc-300 hover:text-orange-300 transition active:scale-95"
              >
                +250 kcal
              </button>
              <button
                type="button"
                onClick={() => updateHabit({ calories: currentCalories + 500 })}
                className="py-2.5 rounded-2xl bg-white/[0.04] hover:bg-orange-500/15 border border-transparent hover:border-orange-500/30 font-mono text-xs font-bold text-zinc-300 hover:text-orange-300 transition active:scale-95"
              >
                +500 kcal
              </button>
              <div className="flex items-center bg-black/60 border border-transparent rounded-2xl px-2">
                <input
                  type="number"
                  inputMode="numeric"
                  value={caloriesInput}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setCaloriesInput(raw);
                    if (caloriesDebounceRef.current) clearTimeout(caloriesDebounceRef.current);
                    caloriesDebounceRef.current = setTimeout(() => {
                      const parsed = raw === '' ? '' : (parseInt(raw, 10) || 0);
                      updateHabit({ calories: parsed });
                    }, 700);
                  }}
                  onBlur={() => {
                    if (caloriesDebounceRef.current) {
                      clearTimeout(caloriesDebounceRef.current);
                      caloriesDebounceRef.current = null;
                      const parsed = caloriesInput === '' ? '' : (parseInt(caloriesInput, 10) || 0);
                      if (parsed !== (habit.calories ?? '')) {
                        updateHabit({ calories: parsed });
                      }
                    }
                  }}
                  placeholder="Manual"
                  className="w-full bg-transparent text-center font-mono text-base sm:text-xs text-white outline-none"
                />
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* CARD 4: SUEÑO & CREATINA (PARALELOS)                      */}
          {/* ========================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* SUEÑO */}
            <div
              onClick={handleToggleSleep}
              className={`p-4 rounded-3xl border transition-all cursor-pointer flex items-center justify-between active:scale-98 ${
                sleepCompleted
                  ? 'bg-purple-950/20 border-purple-500/40 shadow-sm'
                  : 'bg-[#141419] border-transparent hover:bg-white/[0.03]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                  <Moon className="w-5 h-5 fill-purple-400/30" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">
                    Sueño 8h
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {sleepCompleted ? 'Recuperación SNC OK' : 'Pendiente'}
                  </span>
                </div>
              </div>

              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all shrink-0 ${
                  sleepCompleted
                    ? 'bg-apple-green text-black font-bold shadow-md shadow-apple-green/30'
                    : 'border border-white/20 bg-white/5'
                }`}
              >
                {sleepCompleted && <Check className="w-4 h-4 stroke-[3]" />}
              </div>
            </div>

            {/* CREATINA */}
            <div
              onClick={handleToggleCreatine}
              className={`p-4 rounded-3xl border transition-all cursor-pointer flex items-center justify-between active:scale-98 ${
                creatineCompleted
                  ? 'bg-emerald-950/20 border-emerald-500/40 shadow-sm'
                  : 'bg-[#141419] border-transparent hover:bg-white/[0.03]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <Leaf className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">
                    Creatina 5g
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {creatineCompleted ? 'Suplementado' : 'Pendiente'}
                  </span>
                </div>
              </div>

              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all shrink-0 ${
                  creatineCompleted
                    ? 'bg-apple-green text-black font-bold shadow-md shadow-apple-green/30'
                    : 'border border-white/20 bg-white/5'
                }`}
              >
                {creatineCompleted && <Check className="w-4 h-4 stroke-[3]" />}
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* CARD 5: CUIDADO FACIAL (SKINCARE DÍA & NOCHE)             */}
          {/* ========================================================= */}
          <div className="p-4 sm:p-5 rounded-3xl bg-[#141419] border border-transparent space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold block">
                    CUIDADO DÉRMICO
                  </span>
                  <span className="text-sm font-bold text-white">
                    Skincare Facial
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold text-zinc-400">
                {(habit.skincareMorning && habit.skincareNight)
                  ? '2/2 Realizado'
                  : (habit.skincareMorning || habit.skincareNight)
                  ? '1/2 Realizado'
                  : '0/2 Realizado'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {/* Día / Mañana Button */}
              <div
                onClick={() => updateHabit({ skincareMorning: !habit.skincareMorning })}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer active:scale-95 flex items-center justify-between ${
                  habit.skincareMorning
                    ? 'bg-amber-500/15 border-amber-500/40 shadow-sm shadow-amber-950/40'
                    : 'bg-white/[0.03] border-transparent hover:bg-white/[0.06]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Sun className={`w-4 h-4 ${habit.skincareMorning ? 'text-amber-400 fill-amber-400/40' : 'text-zinc-500'}`} />
                  <div>
                    <span className="text-xs font-bold text-white block">Día</span>
                    <span className="text-[9px] font-mono text-zinc-400 block mt-0.5">SPF 50 & Crema</span>
                  </div>
                </div>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                  habit.skincareMorning ? 'bg-amber-400 text-black font-bold shadow-sm' : 'border border-white/20 bg-white/5'
                }`}>
                  {habit.skincareMorning && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>

              {/* Noche Button */}
              <div
                onClick={() => updateHabit({ skincareNight: !habit.skincareNight })}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer active:scale-95 flex items-center justify-between ${
                  habit.skincareNight
                    ? 'bg-indigo-500/15 border-indigo-500/40 shadow-sm shadow-indigo-950/40'
                    : 'bg-white/[0.03] border-transparent hover:bg-white/[0.06]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Moon className={`w-4 h-4 ${habit.skincareNight ? 'text-indigo-400 fill-indigo-400/40' : 'text-zinc-500'}`} />
                  <div>
                    <span className="text-xs font-bold text-white block">Noche</span>
                    <span className="text-[9px] font-mono text-zinc-400 block mt-0.5">Limpieza & Retinol</span>
                  </div>
                </div>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                  habit.skincareNight ? 'bg-indigo-400 text-black font-bold shadow-sm' : 'border border-white/20 bg-white/5'
                }`}>
                  {habit.skincareNight && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* CARD 6: MOVILIDAD & DESCOMPRESIÓN (191cm)                 */}
          {/* ========================================================= */}
          <div className="p-4 sm:p-5 rounded-3xl bg-[#141419] border border-transparent space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <HeartPulse className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold block">
                    DESCOMPRESIÓN 191cm
                  </span>
                  <span className="text-sm font-bold text-white">
                    Movilidad Espinal
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold text-zinc-400">
                {(habit.mobilityMorning && habit.mobilityNight)
                  ? '2/2 Realizado'
                  : (habit.mobilityMorning || habit.mobilityNight)
                  ? '1/2 Realizado'
                  : '0/2 Realizado'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {/* Mañana Button */}
              <div
                onClick={() => updateHabit({ mobilityMorning: !habit.mobilityMorning })}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer active:scale-95 flex items-center justify-between ${
                  habit.mobilityMorning
                    ? 'bg-cyan-500/15 border-cyan-500/40 shadow-sm shadow-cyan-950/40'
                    : 'bg-white/[0.03] border-transparent hover:bg-white/[0.06]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Activity className={`w-4 h-4 ${habit.mobilityMorning ? 'text-cyan-400' : 'text-zinc-500'}`} />
                  <div>
                    <span className="text-xs font-bold text-white block">Mañana</span>
                    <span className="text-[9px] font-mono text-zinc-400 block mt-0.5">Dead hangs & Cat-cow</span>
                  </div>
                </div>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                  habit.mobilityMorning ? 'bg-cyan-400 text-black font-bold shadow-sm' : 'border border-white/20 bg-white/5'
                }`}>
                  {habit.mobilityMorning && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>

              {/* Noche Button */}
              <div
                onClick={() => updateHabit({ mobilityNight: !habit.mobilityNight })}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer active:scale-95 flex items-center justify-between ${
                  habit.mobilityNight
                    ? 'bg-purple-500/15 border-purple-500/40 shadow-sm shadow-purple-950/40'
                    : 'bg-white/[0.03] border-transparent hover:bg-white/[0.06]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <HeartPulse className={`w-4 h-4 ${habit.mobilityNight ? 'text-purple-400' : 'text-zinc-500'}`} />
                  <div>
                    <span className="text-xs font-bold text-white block">Noche</span>
                    <span className="text-[9px] font-mono text-zinc-400 block mt-0.5">Foam roller & Psoas</span>
                  </div>
                </div>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                  habit.mobilityNight ? 'bg-purple-400 text-black font-bold shadow-sm' : 'border border-white/20 bg-white/5'
                }`}>
                  {habit.mobilityNight && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons: Guardar Hábitos (Primary) and Cerrar (Secondary) */}
        <div className="pt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              if (onSave) onSave(habit);
              onClose();
            }}
            disabled={saving}
            className="w-full py-4 rounded-2xl bg-viltrum-crimson hover:bg-rose-600 active:scale-98 text-white font-extrabold text-sm shadow-xl shadow-rose-950/80 transition flex items-center justify-center gap-2 border border-rose-400/30"
          >
            <Check className="w-5 h-5 stroke-[3]" />
            <span>{saving ? 'Guardando cambios...' : 'Guardar Hábitos y Cerrar'}</span>
          </button>
          
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 rounded-xl bg-transparent hover:bg-white/5 active:scale-98 text-zinc-400 hover:text-white font-mono text-xs transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
