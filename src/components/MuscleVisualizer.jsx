import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Sparkles, Zap, Flame, Eye, Layers } from 'lucide-react';
import {
  FRONT_OUTLINE,
  BACK_OUTLINE,
  bodyFront,
  bodyBack,
  FRONT_SLUG_MAP,
  BACK_SLUG_MAP,
  EXERCISE_MUSCLE_MAP,
  MUSCLE_NAMES_ES
} from '../data/muscleData';

export default function MuscleVisualizer({
  currentPlan,
  activeExerciseId,
  focusedMuscle,
  onSelectMuscle,
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeView, setActiveView] = useState('both'); // 'both' | 'front' | 'back'

  if (!currentPlan || currentPlan.isRestDay) return null;

  // Determine active muscles
  let primaryMuscles = new Set();
  let secondaryMuscles = new Set();
  let statusText = 'Objetivo de la Sesión';

  if (activeExerciseId && EXERCISE_MUSCLE_MAP[activeExerciseId]) {
    const map = EXERCISE_MUSCLE_MAP[activeExerciseId];
    statusText = map.label || 'Ejercicio Seleccionado';
    map.primary.forEach((m) => primaryMuscles.add(m));
    map.secondary.forEach((m) => secondaryMuscles.add(m));
  } else if (focusedMuscle) {
    statusText = `Grupo: ${MUSCLE_NAMES_ES[focusedMuscle] || focusedMuscle}`;
    primaryMuscles.add(focusedMuscle);
  } else {
    (currentPlan.exercises || []).forEach((ex) => {
      const map = EXERCISE_MUSCLE_MAP[ex.id];
      if (map) {
        map.primary.forEach((m) => primaryMuscles.add(m));
        map.secondary.forEach((m) => secondaryMuscles.add(m));
      }
    });
  }

  const isMusclePrimary = (groupStr) => {
    if (!groupStr) return false;
    const groups = groupStr.split(' ');
    return groups.some((g) => primaryMuscles.has(g));
  };

  const isMuscleSecondary = (groupStr) => {
    if (!groupStr) return false;
    const groups = groupStr.split(' ');
    return groups.some((g) => secondaryMuscles.has(g));
  };

  const neutralSlugs = ['head', 'hair', 'hands', 'feet', 'knees', 'ankles'];

  // Global SVG Gradients matching GymBook iOS app design
  const renderGradients = () => (
    <defs>
      {/* 3D Neutral Muscle Shader */}
      <linearGradient id="muscle3dDefault" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#282830" />
        <stop offset="50%" stopColor="#1e1e24" />
        <stop offset="100%" stopColor="#141418" />
      </linearGradient>

      {/* Hover Muscle Shader */}
      <linearGradient id="muscle3dHover" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#3c3c48" />
        <stop offset="50%" stopColor="#2c2c34" />
        <stop offset="100%" stopColor="#202026" />
      </linearGradient>

      {/* Neutral Base (Head, hands, joints) */}
      <linearGradient id="neutralAnatomyGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#1c1c20" />
        <stop offset="100%" stopColor="#0f0f13" />
      </linearGradient>

      {/* GymBook Hyper-Heat Primary (Crimson to Radiant Flame Red) */}
      <linearGradient id="gymbookHeatPrimary" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ff4b72" />
        <stop offset="45%" stopColor="#ff2d55" />
        <stop offset="100%" stopColor="#c70039" />
      </linearGradient>

      {/* GymBook Heat Secondary (Golden Amber to Molten Orange) */}
      <linearGradient id="gymbookHeatSecondary" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ffb84d" />
        <stop offset="50%" stopColor="#ff9500" />
        <stop offset="100%" stopColor="#d96b00" />
      </linearGradient>
    </defs>
  );

  const renderFront = () => (
    <>
      <path d={FRONT_OUTLINE} className="pro-body-outline" />
      {bodyFront
        .filter((item) => neutralSlugs.includes(item.slug))
        .map((item) => {
          const pathObj = item.path;
          return ['common', 'left', 'right'].map((side) =>
            (pathObj[side] || []).map((d, i) => (
              <path key={`f-base-${item.slug}-${side}-${i}`} d={d} className="pro-body-base" />
            ))
          );
        })}
      {bodyFront
        .filter((item) => !neutralSlugs.includes(item.slug))
        .map((item) => {
          const group = FRONT_SLUG_MAP[item.slug] || '';
          const pathObj = item.path;
          const primary = isMusclePrimary(group);
          const secondary = !primary && isMuscleSecondary(group);

          return ['common', 'left', 'right'].map((side) =>
            (pathObj[side] || []).map((d, i) => (
              <path
                key={`f-m-${item.slug}-${side}-${i}`}
                d={d}
                onClick={(e) => {
                  e.stopPropagation();
                  const first = group.split(' ')[0];
                  if (first) onSelectMuscle(first);
                }}
                className={`pro-muscle ${
                  primary ? 'active-primary pulse' : secondary ? 'active-secondary' : ''
                }`}
              />
            ))
          );
        })}
    </>
  );

  const renderBack = () => (
    <>
      <path d={BACK_OUTLINE} className="pro-body-outline" />
      {bodyBack
        .filter((item) => neutralSlugs.includes(item.slug))
        .map((item) => {
          const pathObj = item.path;
          return ['common', 'left', 'right'].map((side) =>
            (pathObj[side] || []).map((d, i) => (
              <path key={`b-base-${item.slug}-${side}-${i}`} d={d} className="pro-body-base" />
            ))
          );
        })}
      {bodyBack
        .filter((item) => !neutralSlugs.includes(item.slug))
        .map((item) => {
          const group = BACK_SLUG_MAP[item.slug] || '';
          const pathObj = item.path;
          const primary = isMusclePrimary(group);
          const secondary = !primary && isMuscleSecondary(group);

          return ['common', 'left', 'right'].map((side) =>
            (pathObj[side] || []).map((d, i) => (
              <path
                key={`b-m-${item.slug}-${side}-${i}`}
                d={d}
                onClick={(e) => {
                  e.stopPropagation();
                  const first = group.split(' ')[0];
                  if (first) onSelectMuscle(first);
                }}
                className={`pro-muscle ${
                  primary ? 'active-primary pulse' : secondary ? 'active-secondary' : ''
                }`}
              />
            ))
          );
        })}
    </>
  );

  const primaryArr = Array.from(primaryMuscles);
  const secondaryArr = Array.from(secondaryMuscles).filter((m) => !primaryMuscles.has(m));

  return (
    <section className="relative overflow-hidden rounded-apple-hero apple-titanium-card p-4 sm:p-10 mb-8 sm:mb-12">
      {/* Background Spotlight Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-36 bg-apple-red/10 blur-3xl pointer-events-none rounded-full" />

      {/* Header Info Showcase & View Angle Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 relative z-10">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-widest text-apple-red font-semibold flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5" />
            GymBook Heat Map Engine
          </span>
          <h3 className="text-xl sm:text-3xl font-bold tracking-tight text-white mt-1">
            Reclutamiento Muscular
          </h3>
          <p className="text-[13px] sm:text-[14px] text-apple-textSecondary mt-1">
            {statusText} · Mapa volumétrico de intensidad y sinergistas
          </p>
        </div>

        {/* GymBook Perspective Segmented Control */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center bg-black/60 p-0.5 sm:p-1 rounded-full border border-white/[0.08]">
            <button
              type="button"
              onClick={() => setActiveView('both')}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition ${
                activeView === 'both'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-apple-textSecondary hover:text-white'
              }`}
            >
              <span className="hidden sm:inline">Frente & Espalda</span>
              <span className="sm:hidden">Ambos</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('front')}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition ${
                activeView === 'front'
                  ? 'bg-apple-red text-white shadow-sm'
                  : 'text-apple-textSecondary hover:text-white'
              }`}
            >
              Frente
            </button>
            <button
              type="button"
              onClick={() => setActiveView('back')}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition ${
                activeView === 'back'
                  ? 'bg-apple-red text-white shadow-sm'
                  : 'text-apple-textSecondary hover:text-white'
              }`}
            >
              Espalda
            </button>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[12px] font-semibold text-apple-textSecondary hover:text-white p-1.5 sm:p-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] transition"
            title={isExpanded ? 'Ocultar' : 'Expandir'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-6 relative z-10">
          {/* GymBook Stage Box */}
          <div className="gymbook-stage rounded-apple-card border border-white/[0.08] p-4 sm:p-10 flex flex-col md:flex-row items-center justify-center gap-6 sm:gap-16">
            {/* Front View */}
            {(activeView === 'both' || activeView === 'front') && (
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-mono tracking-widest text-apple-textTertiary uppercase mb-2">
                  Plano Anterior (Frente)
                </span>
                <svg
                  viewBox="0 0 724 1448"
                  className="h-[260px] xs:h-[300px] sm:h-[400px] w-auto drop-shadow-[0_15px_35px_rgba(0,0,0,0.9)] max-w-full"
                >
                  {renderGradients()}
                  {renderFront()}
                </svg>
              </div>
            )}

            {/* Back View */}
            {(activeView === 'both' || activeView === 'back') && (
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-mono tracking-widest text-apple-textTertiary uppercase mb-2">
                  Plano Posterior (Espalda)
                </span>
                <svg
                  viewBox="724 0 724 1448"
                  className="h-[260px] xs:h-[300px] sm:h-[400px] w-auto drop-shadow-[0_15px_35px_rgba(0,0,0,0.9)] max-w-full"
                >
                  {renderGradients()}
                  {renderBack()}
                </svg>
              </div>
            )}
          </div>

          {/* Muscle Focus Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {(focusedMuscle || activeExerciseId) && (
              <button
                onClick={() => onSelectMuscle(null)}
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition active:scale-95 border border-white/10"
              >
                Ver sesión completa
              </button>
            )}

            {primaryArr.map((m) => (
              <button
                key={m}
                onClick={() => onSelectMuscle(m)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition active:scale-95 flex items-center gap-1.5 ${
                  focusedMuscle === m
                    ? 'bg-apple-red text-white shadow-apple-red-glow font-bold'
                    : 'bg-apple-red/15 text-apple-red hover:bg-apple-red/25 border border-apple-red/30'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>{MUSCLE_NAMES_ES[m] || m}</span>
                <span className="text-[10px] font-mono opacity-80 uppercase tracking-wider">Primario</span>
              </button>
            ))}

            {secondaryArr.map((m) => (
              <button
                key={m}
                onClick={() => onSelectMuscle(m)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition active:scale-95 flex items-center gap-1.5 ${
                  focusedMuscle === m
                    ? 'bg-apple-orange text-white font-bold'
                    : 'bg-apple-orange/15 text-apple-orange hover:bg-apple-orange/25 border border-apple-orange/30'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{MUSCLE_NAMES_ES[m] || m}</span>
                <span className="text-[10px] font-mono opacity-80 uppercase tracking-wider">Sinergista</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
