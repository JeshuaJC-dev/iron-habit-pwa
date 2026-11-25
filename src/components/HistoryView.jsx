import React, { useState, useMemo } from 'react';
import { Flame, TrendingUp, Calendar, ChevronRight, Award, Zap, ChevronDown, ChevronUp, Check, Activity, Dumbbell, ExternalLink, Scale, Droplets, Leaf } from 'lucide-react';
import { getMondayLocalKey, formatLocalDate } from '../utils/date';

export default function HistoryView({
  dashboardData = {},
  allWorkouts = {},
  routineData = {},
  onSelectSession
}) {
  const [selectedRange, setSelectedRange] = useState('8 sem');
  const [showRangeMenu, setShowRangeMenu] = useState(false);
  const [activePR, setActivePR] = useState(null);
  const [showAllPRs, setShowAllPRs] = useState(false);
  const [expandedSessionDate, setExpandedSessionDate] = useState(null);
  const [showAllSessions, setShowAllSessions] = useState(false);

  // Telemetry Graph State
  const [selectedExerciseId, setSelectedExerciseId] = useState('press_banca');
  const [chartMetric, setChartMetric] = useState('maxE1rm'); // 'maxE1rm' | 'maxWeight' | 'volume'
  const [activePoint, setActivePoint] = useState(null);

  const rangeOptions = ['4 sem', '8 sem', '12 sem', 'Todo'];

  // 1. Extract PRs from database (memoized)
  const prs = dashboardData?.prs || {};
  const prList = useMemo(() => (
    Object.entries(prs).map(([exId, data]) => ({
      exId,
      name: data.exerciseName || exId,
      weight: data.weight || 0,
      reps: data.reps || 0,
      e1rm: data.e1rm || 0,
      date: data.date || '',
    })).sort((a, b) => b.e1rm - a.e1rm)
  ), [prs]);

  // 2. Extract all sessions sorted newest first (memoized)
  const filterLimit = selectedRange === '4 sem' ? 16 : selectedRange === '8 sem' ? 32 : selectedRange === '12 sem' ? 48 : 500;

  const sessions = useMemo(() => {
    const allSessionEntries = Object.entries(allWorkouts)
      .filter(([_, w]) => w && w.exercises)
      .sort(([dateA], [dateB]) => dateB.localeCompare(dateA));

    return allSessionEntries
      .slice(0, filterLimit)
      .map(([date, w]) => {
        const d = new Date(date + 'T12:00:00');
        const dayShort = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'][d.getDay()];
        const dayNum = d.getDate();

        let volume = 0;
        let setsCount = 0;
        const exercises = w.exercises || {};
        const exercisesCount = Object.keys(exercises).length;

        for (const sets of Object.values(exercises)) {
          for (const s of sets || []) {
            const wVal = parseFloat(s.weight) || 0;
            const rVal = parseInt(s.reps, 10) || 0;
            if (wVal > 0 || rVal > 0 || s.checked) {
              setsCount++;
              volume += wVal * rVal;
            }
          }
        }

        return {
          date,
          dayShort,
          dayNum,
          sessionName: w.sessionName || 'Entrenamiento',
          volume: Math.round(volume),
          setsCount,
          exercisesCount,
          exercisesData: exercises,
          notes: w.notes || '',
        };
      });
  }, [allWorkouts, filterLimit]);

  // Real total volume across filtered sessions in tons
  const totalVolumeKg = useMemo(() => sessions.reduce((acc, s) => acc + s.volume, 0), [sessions]);
  const totalVolumeTons = (totalVolumeKg / 1000).toFixed(1);

  // 3. Weekly Volume Bars (Monday-based grouping in local timezone, memoized)
  const rangeWeeksCount = selectedRange === '4 sem' ? 4 : selectedRange === '8 sem' ? 8 : selectedRange === '12 sem' ? 12 : 52;
  const { weeklyBars, bestWeekObj, chartMaxVol, progressionText } = useMemo(() => {
    const weeklyMap = {};
    for (const [date, w] of Object.entries(allWorkouts)) {
      if (!w || !w.exercises) continue;
      const weekKey = getMondayLocalKey(date);

      if (!weeklyMap[weekKey]) {
        weeklyMap[weekKey] = {
          weekStart: weekKey,
          volume: 0,
          sessionsCount: 0,
        };
      }

      for (const sets of Object.values(w.exercises || {})) {
        for (const s of sets || []) {
          const wVal = parseFloat(s.weight) || 0;
          const rVal = parseInt(s.reps, 10) || 0;
          weeklyMap[weekKey].volume += wVal * rVal;
        }
      }
      weeklyMap[weekKey].sessionsCount += 1;
    }

    const sortedWeeklyList = Object.values(weeklyMap).sort((a, b) =>
      a.weekStart.localeCompare(b.weekStart)
    );

    const allWeeklyBars = sortedWeeklyList.map((item, idx) => ({
      label: `S${idx + 1}`,
      volume: Math.round(item.volume),
      sessionsCount: item.sessionsCount,
      weekStart: item.weekStart,
    }));

    const maxWeeklyVol = allWeeklyBars.length > 0 ? Math.max(...allWeeklyBars.map((b) => b.volume)) : 0;
    const best = allWeeklyBars.find((b) => b.volume === maxWeeklyVol) || { label: 'S1', volume: 0 };

    const bars = allWeeklyBars
      .map((b) => ({ ...b, isBest: b.volume === maxWeeklyVol && maxWeeklyVol > 0 }))
      .slice(-rangeWeeksCount);

    const maxVol = Math.max(...bars.map((b) => b.volume), 1000);

    let progText = 'Base del programa establecida';
    if (allWeeklyBars.length >= 2 && allWeeklyBars[0].volume > 0) {
      const diffPercent = Math.round(((best.volume - allWeeklyBars[0].volume) / allWeeklyBars[0].volume) * 100);
      if (diffPercent > 0) {
        progText = `↑ +${diffPercent}% sobrecarga progresiva (S1 → ${best.label})`;
      }
    }

    return { weeklyBars: bars, bestWeekObj: best, chartMaxVol: maxVol, progressionText: progText };
  }, [allWorkouts, rangeWeeksCount]);

  const targetSessionsCount = (weeklyBars.length || 1) * 4;
  const adherencePercent = Math.min(100, Math.round((sessions.length / targetSessionsCount) * 100));
  const displayedPRs = showAllPRs ? prList : prList.slice(0, 4);

  // 4. Telemetry Graph Data Extraction for All Tracked Exercises (memoized)
  const { exerciseTelemetryMap, availableExerciseKeys } = useMemo(() => {
    const map = {};
    const workoutDatesAsc = Object.keys(allWorkouts).sort();
    for (const d of workoutDatesAsc) {
      const w = allWorkouts[d];
      if (!w || !w.exercises) continue;
      for (const [exId, sets] of Object.entries(w.exercises)) {
        if (!sets || sets.length === 0) continue;
        if (!map[exId]) {
          let prettyName = exId.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
          if (prs[exId]?.exerciseName) prettyName = prs[exId].exerciseName;

          map[exId] = {
            id: exId,
            name: prettyName,
            points: [],
          };
        }

        let maxW = 0;
        let maxE1 = 0;
        let exVol = 0;
        let bestR = 0;

        for (const s of sets) {
          const wt = parseFloat(s.weight) || 0;
          const rp = parseInt(s.reps, 10) || 0;
          const e1 = s.e1rm || (wt > 0 && rp > 0 ? (rp === 1 ? wt : Math.round(wt * (1 + rp / 30) * 10) / 10) : 0);
          if (wt > maxW) {
            maxW = wt;
            bestR = rp;
          }
          if (e1 > maxE1) maxE1 = Math.round(e1 * 10) / 10;
          exVol += wt * rp;
        }

        if (maxW > 0 || maxE1 > 0 || exVol > 0) {
          const dateShort = new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
          map[exId].points.push({
            date: d,
            dateShort,
            maxWeight: maxW,
            maxE1rm: maxE1,
            volume: Math.round(exVol),
            bestReps: bestR,
          });
        }
      }
    }
    const keys = Object.keys(map).filter((k) => map[k].points.length >= 1);
    return { exerciseTelemetryMap: map, availableExerciseKeys: keys };
  }, [allWorkouts, prs]);
  const activeExId = exerciseTelemetryMap[selectedExerciseId]?.points?.length ? selectedExerciseId : (availableExerciseKeys[0] || 'press_banca');
  const currentExTelemetry = exerciseTelemetryMap[activeExId] || { name: 'Ejercicio', points: [] };
  const graphPointsRaw = currentExTelemetry.points || [];

  // SVG Geometry Calculation
  const svgWidth = 680;
  const svgHeight = 220;
  const padX = 45;
  const padY = 32;

  const rawValues = graphPointsRaw.map((p) => p[chartMetric] || 0);
  const rawMin = rawValues.length > 0 ? Math.min(...rawValues) : 0;
  const rawMax = rawValues.length > 0 ? Math.max(...rawValues) : 100;
  // Buffer on Y axis
  const chartMinVal = Math.max(0, Math.floor(rawMin * 0.9));
  const chartMaxValY = Math.ceil(rawMax * 1.1) || 100;

  const svgPoints = graphPointsRaw.map((pt, idx) => {
    const x = graphPointsRaw.length === 1
      ? svgWidth / 2
      : padX + (idx / (graphPointsRaw.length - 1)) * (svgWidth - padX * 2);
    const y = svgHeight - padY - ((pt[chartMetric] - chartMinVal) / (chartMaxValY - chartMinVal || 1)) * (svgHeight - padY * 2);
    return {
      ...pt,
      x,
      y,
      val: pt[chartMetric],
    };
  });

  // Smooth Bezier Curve Path
  let bezierPath = '';
  let areaPath = '';
  if (svgPoints.length > 0) {
    bezierPath = `M ${svgPoints[0].x} ${svgPoints[0].y}`;
    for (let i = 1; i < svgPoints.length; i++) {
      const prev = svgPoints[i - 1];
      const cur = svgPoints[i];
      const cx1 = prev.x + (cur.x - prev.x) * 0.5;
      const cy1 = prev.y;
      const cx2 = prev.x + (cur.x - prev.x) * 0.5;
      const cy2 = cur.y;
      bezierPath += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${cur.x} ${cur.y}`;
    }
    const last = svgPoints[svgPoints.length - 1];
    areaPath = `${bezierPath} L ${last.x} ${svgHeight - padY} L ${svgPoints[0].x} ${svgHeight - padY} Z`;
  }

  // Progression delta for active exercise
  let exDeltaText = 'Sin historial previo';
  if (graphPointsRaw.length >= 2) {
    const firstVal = graphPointsRaw[0][chartMetric];
    const lastVal = graphPointsRaw[graphPointsRaw.length - 1][chartMetric];
    const diff = Math.round((lastVal - firstVal) * 10) / 10;
    const pct = firstVal > 0 ? Math.round(((lastVal - firstVal) / firstVal) * 100) : 0;
    const unit = chartMetric === 'volume' ? 'kg vol' : 'kg';
    if (diff > 0) {
      exDeltaText = `↑ +${diff} ${unit} (+${pct}%) en ${graphPointsRaw.length} sesiones`;
    } else if (diff === 0) {
      exDeltaText = `Carga mantenida en ${graphPointsRaw.length} sesiones`;
    } else {
      exDeltaText = `${diff} ${unit} (${pct}%)`;
    }
  }

  // 5. Bodyweight Evolution Chart (memoized)
  const bodyweightStats = useMemo(() => {
    const list = (dashboardData?.bodyweight || [])
      .filter((b) => b && b.date && Number.isFinite(parseFloat(b.weight)))
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date));

    if (list.length === 0) return { list: [], points: [], path: '', latest: null, delta: null, minW: 70, maxW: 82 };

    const weights = list.map((b) => parseFloat(b.weight));
    const minW = Math.floor(Math.min(...weights) - 1);
    const maxW = Math.ceil(Math.max(...weights) + 1);
    const wSvg = 600;
    const hSvg = 140;
    const px = 38;
    const py = 22;

    const points = list.map((b, i) => {
      const val = parseFloat(b.weight);
      const x = list.length === 1 ? wSvg / 2 : px + (i / (list.length - 1)) * (wSvg - px * 2);
      const y = hSvg - py - ((val - minW) / (maxW - minW || 1)) * (hSvg - py * 2);
      const dateShort = new Date(b.date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
      return { date: b.date, dateShort, weight: val, x, y };
    });

    let path = '';
    if (points.length > 0) {
      path = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const cur = points[i];
        const cx = prev.x + (cur.x - prev.x) * 0.5;
        path += ` C ${cx} ${prev.y}, ${cx} ${cur.y}, ${cur.x} ${cur.y}`;
      }
    }

    const latest = points[points.length - 1];
    const delta = points.length >= 2 ? Math.round((latest.weight - points[0].weight) * 10) / 10 : null;
    return { list, points, path, latest, delta, minW, maxW, wSvg, hSvg, px, py };
  }, [dashboardData?.bodyweight]);

  // 6. Last 7 Days Habits Adherence Summary (memoized)
  const weeklyHabits = useMemo(() => {
    const habitsMap = dashboardData?.habits || {};
    const days = [];
    const today = new Date();
    const dayLabels = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

    for (let offset = 6; offset >= 0; offset--) {
      const d = new Date(today);
      d.setDate(today.getDate() - offset);
      const key = formatLocalDate(d);
      const h = habitsMap[key] || null;
      const waterOk = (parseFloat(h?.water) || 0) >= 3.0;
      const proteinOk = (parseInt(h?.protein, 10) || 0) >= 150;
      const sleepOk = (parseFloat(h?.sleepHours) || 0) >= 7.5;
      const creatineOk = Boolean(h?.creatine);
      days.push({
        date: key,
        label: dayLabels[d.getDay()],
        dayNum: d.getDate(),
        isToday: offset === 0,
        hasData: Boolean(h),
        water: parseFloat(h?.water) || 0,
        protein: parseInt(h?.protein, 10) || 0,
        waterOk,
        proteinOk,
        sleepOk,
        creatineOk
      });
    }

    const activeDays = days.filter((d) => d.hasData);
    const avgWater = activeDays.length > 0
      ? (activeDays.reduce((a, b) => a + b.water, 0) / activeDays.length).toFixed(1)
      : '0.0';
    const avgProtein = activeDays.length > 0
      ? Math.round(activeDays.reduce((a, b) => a + b.protein, 0) / activeDays.length)
      : 0;
    const creatineDays = days.filter((d) => d.creatineOk).length;

    return { days, avgWater, avgProtein, creatineDays, loggedCount: activeDays.length };
  }, [dashboardData?.habits]);

  return (
    <div className="space-y-5 pb-32 animate-fade-in select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between pt-1 relative">
        <div>
          <span className="text-[11px] font-mono font-bold tracking-widest text-viltrum-crimson uppercase">
            {selectedRange === 'Todo' ? 'TODO EL HISTORIAL' : `ÚLTIMAS ${selectedRange.toUpperCase()}`}
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-0.5">
            Rendimiento
          </h1>
        </div>

        {/* Range Selector Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowRangeMenu(!showRangeMenu)}
            className="px-3 py-1.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] active:scale-95 border border-transparent flex items-center gap-1.5 text-xs font-mono font-bold text-zinc-300 transition"
          >
            <span>{selectedRange}</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {showRangeMenu && (
            <div className="absolute right-0 top-10 w-28 bg-[#18181f] border border-transparent rounded-2xl p-1.5 shadow-2xl z-30 space-y-1 animate-scale-in">
              {rangeOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    setSelectedRange(opt);
                    setShowRangeMenu(false);
                  }}
                  className={`w-full py-1.5 px-2.5 rounded-xl text-left text-xs font-mono transition flex items-center justify-between ${
                    selectedRange === opt
                      ? 'bg-viltrum-crimson text-white font-bold'
                      : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span>{opt}</span>
                  {selectedRange === opt && <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* TOP 2 KPI TILES */}
      <div className="grid grid-cols-2 gap-3">
        {/* Total Volume */}
        <div className="p-4 rounded-3xl bg-[#121217] border border-white/[0.07] relative overflow-hidden">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-bold block mb-1">
            VOLUMEN TOTAL
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-mono font-black text-white">
              {totalVolumeTons}
            </span>
            <span className="text-sm font-mono font-bold text-zinc-400">t</span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 font-bold block mt-1 truncate">
            {progressionText}
          </span>
        </div>

        {/* Sessions & Adherence */}
        <div className="p-4 rounded-3xl bg-[#121217] border border-white/[0.07] relative overflow-hidden">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-bold block mb-1">
            SESIONES
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-mono font-black text-white">
              {sessions.length}
            </span>
            <span className="text-sm font-mono font-bold text-zinc-500">/{targetSessionsCount}</span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 font-bold block mt-1">
            {adherencePercent}% adherencia ({sessions.length} de {targetSessionsCount})
          </span>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 1. CURVA DE TELEMETRÍA Y PROGRESIÓN (GRÁFICA DE PROGRESO)       */}
      {/* ============================================================== */}
      <div className="p-4 sm:p-5 rounded-3xl bg-[#121217] border border-white/[0.07] space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <Activity className="w-3.5 h-3.5 text-rose-500" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-rose-400 font-bold">
                TELEMETRÍA & CURVA DE PROGRESIÓN
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-white">
              {currentExTelemetry.name}
            </h3>
            <span className="text-[11px] font-mono text-emerald-400 font-bold block mt-0.5">
              {exDeltaText}
            </span>
          </div>

          {/* Metric Selector Pills */}
          <div className="flex items-center gap-1 bg-black/50 p-1 rounded-2xl border border-transparent self-start sm:self-center">
            {[
              { id: 'maxE1rm', label: '1RM Est.' },
              { id: 'maxWeight', label: 'Carga' },
              { id: 'volume', label: 'Volumen' },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setChartMetric(m.id)}
                className={`py-1 px-2.5 rounded-xl font-mono text-[10px] font-bold transition active:scale-95 ${
                  chartMetric === m.id
                    ? 'bg-viltrum-crimson text-white shadow-md shadow-rose-950/60'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Exercise Chips Horizontal Scroll */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {availableExerciseKeys.slice(0, 10).map((exKey) => {
            const exData = exerciseTelemetryMap[exKey];
            const isSelected = activeExId === exKey;
            return (
              <button
                key={exKey}
                type="button"
                onClick={() => {
                  setSelectedExerciseId(exKey);
                  setActivePoint(null);
                }}
                className={`py-1 px-3 rounded-full font-mono text-[10px] font-bold whitespace-nowrap transition active:scale-95 shrink-0 border ${
                  isSelected
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-sm'
                    : 'bg-white/[0.04] text-zinc-400 border-transparent hover:bg-white/[0.08] hover:text-white'
                }`}
              >
                {exData.name.split(' ')[0]} {exData.name.split(' ')[1] || ''}
              </button>
            );
          })}
        </div>

        {/* The SVG Telemetry Bézier Graph */}
        {svgPoints.length === 0 ? (
          <div className="h-44 flex flex-col items-center justify-center text-center font-mono text-xs text-zinc-500">
            <span>Sin datos registrados para este ejercicio</span>
          </div>
        ) : (
          <div className="relative pt-2">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-48 sm:h-56 overflow-visible select-none"
            >
              <defs>
                <linearGradient id="roseAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e11d48" stopOpacity="0.4" />
                  <stop offset="70%" stopColor="#e11d48" stopOpacity="0.05" />
                  <stop offset="100%" stopColor="#e11d48" stopOpacity="0.0" />
                </linearGradient>
                <filter id="roseLineGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#e11d48" floodOpacity="0.7" />
                </filter>
              </defs>

              {/* Horizontal Grid Lines */}
              {[0, 0.33, 0.66, 1].map((pct, i) => {
                const y = padY + pct * (svgHeight - padY * 2);
                const val = Math.round(chartMaxValY - pct * (chartMaxValY - chartMinVal));
                return (
                  <g key={i}>
                    <line
                      x1={padX}
                      y1={y}
                      x2={svgWidth - padX}
                      y2={y}
                      stroke="rgba(255, 255, 255, 0.05)"
                      strokeDasharray={i === 3 ? 'none' : '3 3'}
                    />
                    <text
                      x={padX - 8}
                      y={y + 3.5}
                      textAnchor="end"
                      className="text-[9px] font-mono fill-zinc-500"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Area Gradient Under Curve */}
              {areaPath && <path d={areaPath} fill="url(#roseAreaGrad)" />}

              {/* Bézier Line Curve */}
              {bezierPath && (
                <path
                  d={bezierPath}
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#roseLineGlow)"
                />
              )}

              {/* Interactive Points and Labels */}
              {svgPoints.map((pt, idx) => {
                const isHovered = activePoint?.date === pt.date;
                return (
                  <g
                    key={pt.date}
                    className="cursor-pointer"
                    onClick={() => setActivePoint(isHovered ? null : pt)}
                  >
                    {/* Vertical guideline on hover */}
                    {isHovered && (
                      <line
                        x1={pt.x}
                        y1={padY / 2}
                        x2={pt.x}
                        y2={svgHeight - padY}
                        stroke="rgba(244, 63, 94, 0.5)"
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                      />
                    )}

                    {/* Outer pulse circle */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 8 : 5}
                      className="transition-all"
                      fill={isHovered ? '#e11d48' : '#141419'}
                      stroke="#f43f5e"
                      strokeWidth={isHovered ? 3 : 2}
                    />

                    {/* Value Badge above point */}
                    <text
                      x={pt.x}
                      y={pt.y - 10}
                      textAnchor="middle"
                      className={`text-[10px] font-mono font-bold transition-opacity ${
                        isHovered ? 'fill-white opacity-100' : 'fill-zinc-400 opacity-80'
                      }`}
                    >
                      {pt.val}
                      <tspan className="text-[8px] fill-zinc-500">kg</tspan>
                    </text>

                    {/* Date label underneath */}
                    <text
                      x={pt.x}
                      y={svgHeight - 12}
                      textAnchor="middle"
                      className={`text-[9px] font-mono ${
                        isHovered ? 'fill-rose-400 font-bold' : 'fill-zinc-500'
                      }`}
                    >
                      {pt.dateShort}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 2. VOLUMEN SEMANAL (BARRAS DE PROGRESIÓN REALES)               */}
      {/* ============================================================== */}
      <div className="p-4 sm:p-5 rounded-3xl bg-[#121217] border border-white/[0.07]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-bold block mb-0.5">
              VOLUMEN SEMANAL (MÁXIMO)
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-mono font-black text-white">
                {bestWeekObj.volume.toLocaleString()}
              </span>
              <span className="text-xs font-mono text-zinc-400">kg</span>
            </div>
          </div>

          <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            MEJOR: {bestWeekObj.label}
          </span>
        </div>

        {/* Real High-Contrast CSS Bar Chart */}
        <div className="flex items-end justify-between gap-2 h-36 pt-4 border-b border-transparent pb-2">
          {weeklyBars.map((bar) => {
            const heightPercent = Math.max(8, Math.round((bar.volume / chartMaxVol) * 100));

            return (
              <div key={bar.label} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                <div className="text-[9px] font-mono text-zinc-400 opacity-0 group-hover:opacity-100 transition truncate">
                  {(bar.volume / 1000).toFixed(1)}t
                </div>
                <div className="w-full max-w-[32px] rounded-lg overflow-hidden bg-white/5 h-full flex items-end">
                  <div
                    className={`w-full rounded-lg transition-all duration-500 ${
                      bar.isBest
                        ? 'bg-viltrum-crimson shadow-lg shadow-rose-950/80 ring-1 ring-rose-400/40'
                        : 'bg-zinc-700/60 group-hover:bg-zinc-600'
                    }`}
                    style={{ height: `${heightPercent}%` }}
                    title={`${bar.label}: ${bar.volume.toLocaleString()} kg (${bar.sessionsCount} sesiones)`}
                  />
                </div>
                <span className={`text-[10px] font-mono ${bar.isBest ? 'text-viltrum-crimson font-bold' : 'text-zinc-500'}`}>
                  {bar.label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 mt-2 px-1">
          <span>Datos calculados directamente de tus sesiones registradas</span>
          <span className="text-rose-400 font-bold">{weeklyBars.length} semanas</span>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2B. EVOLUCIÓN DE PESO CORPORAL                                 */}
      {/* ============================================================== */}
      <div className="p-4 sm:p-5 rounded-3xl bg-[#121217] border border-white/[0.07] space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <Scale className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold">
                PESO CORPORAL
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-mono font-black text-white">
                {bodyweightStats.latest ? bodyweightStats.latest.weight : '—'}
              </span>
              <span className="text-xs font-mono text-zinc-400">kg</span>
              {bodyweightStats.delta !== null && (
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                  bodyweightStats.delta >= 0
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-rose-500/15 text-rose-400'
                }`}>
                  {bodyweightStats.delta >= 0 ? `+${bodyweightStats.delta}` : bodyweightStats.delta} kg
                </span>
              )}
            </div>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">
            {bodyweightStats.list.length} {bodyweightStats.list.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        {bodyweightStats.points.length > 0 ? (
          <svg
            viewBox={`0 0 ${bodyweightStats.wSvg} ${bodyweightStats.hSvg}`}
            className="w-full h-32 overflow-visible select-none"
          >
            {[0, 0.5, 1].map((pct, i) => {
              const y = bodyweightStats.py + pct * (bodyweightStats.hSvg - bodyweightStats.py * 2);
              const val = (bodyweightStats.maxW - pct * (bodyweightStats.maxW - bodyweightStats.minW)).toFixed(1);
              return (
                <g key={i}>
                  <line
                    x1={bodyweightStats.px}
                    y1={y}
                    x2={bodyweightStats.wSvg - bodyweightStats.px}
                    y2={y}
                    stroke="rgba(255,255,255,0.06)"
                    strokeDasharray="3 3"
                  />
                  <text x={bodyweightStats.px - 6} y={y + 3} textAnchor="end" className="text-[9px] font-mono fill-zinc-500">
                    {val}
                  </text>
                </g>
              );
            })}
            {bodyweightStats.path && (
              <path
                d={bodyweightStats.path}
                fill="none"
                stroke="#fbbf24"
                strokeWidth="3"
                strokeLinecap="round"
              />
            )}
            {bodyweightStats.points.map((pt) => (
              <g key={pt.date}>
                <circle cx={pt.x} cy={pt.y} r="5" fill="#121217" stroke="#fbbf24" strokeWidth="2.5" />
                <text x={pt.x} y={pt.y - 10} textAnchor="middle" className="text-[10px] font-mono font-bold fill-amber-200">
                  {pt.weight}kg
                </text>
                <text x={pt.x} y={bodyweightStats.hSvg - 4} textAnchor="middle" className="text-[9px] font-mono fill-zinc-500">
                  {pt.dateShort}
                </text>
              </g>
            ))}
          </svg>
        ) : (
          <p className="text-xs font-mono text-zinc-500 py-3 text-center">
            Actualiza tu peso en Perfil → Editar para ver tu curva de evolución.
          </p>
        )}
      </div>

      {/* ============================================================== */}
      {/* 2C. RESUMEN DE HÁBITOS (ÚLTIMOS 7 DÍAS)                        */}
      {/* ============================================================== */}
      <div className="p-4 sm:p-5 rounded-3xl bg-[#121217] border border-white/[0.07] space-y-3.5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400 font-bold block">
              HÁBITOS · ÚLTIMOS 7 DÍAS
            </span>
            <h3 className="text-base font-extrabold text-white mt-0.5">
              Adherencia diaria
            </h3>
          </div>
          <span className="text-[10px] font-mono text-zinc-400 font-bold">
            {weeklyHabits.loggedCount}/7 días
          </span>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {weeklyHabits.days.map((d) => (
            <div
              key={d.date}
              className={`rounded-2xl p-2 flex flex-col items-center gap-1.5 border ${
                d.isToday
                  ? 'bg-viltrum-crimson/15 border-viltrum-crimson/40'
                  : d.hasData
                    ? 'bg-white/[0.04] border-white/[0.07]'
                    : 'bg-black/30 border-white/[0.04]'
              }`}
            >
              <span className={`text-[9px] font-mono font-bold ${d.isToday ? 'text-rose-300' : 'text-zinc-500'}`}>
                {d.label}
              </span>
              <span className="text-xs font-mono font-black text-white">{d.dayNum}</span>
              <div className="grid grid-cols-2 gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${d.waterOk ? 'bg-blue-400' : 'bg-white/10'}`} title="Agua" />
                <span className={`w-1.5 h-1.5 rounded-full ${d.proteinOk ? 'bg-rose-400' : 'bg-white/10'}`} title="Proteína" />
                <span className={`w-1.5 h-1.5 rounded-full ${d.sleepOk ? 'bg-purple-400' : 'bg-white/10'}`} title="Sueño" />
                <span className={`w-1.5 h-1.5 rounded-full ${d.creatineOk ? 'bg-emerald-400' : 'bg-white/10'}`} title="Creatina" />
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1 text-center">
          <div className="p-2 rounded-2xl bg-black/40 border border-white/[0.05]">
            <span className="flex items-center justify-center gap-1 text-[9px] font-mono text-blue-400 uppercase font-bold">
              <Droplets className="w-3 h-3" /> Agua
            </span>
            <span className="text-xs font-mono font-black text-white block mt-0.5">{weeklyHabits.avgWater} L/d</span>
          </div>
          <div className="p-2 rounded-2xl bg-black/40 border border-white/[0.05]">
            <span className="flex items-center justify-center gap-1 text-[9px] font-mono text-rose-400 uppercase font-bold">
              <Zap className="w-3 h-3" /> Prote
            </span>
            <span className="text-xs font-mono font-black text-white block mt-0.5">{weeklyHabits.avgProtein} g/d</span>
          </div>
          <div className="p-2 rounded-2xl bg-black/40 border border-white/[0.05]">
            <span className="flex items-center justify-center gap-1 text-[9px] font-mono text-emerald-400 uppercase font-bold">
              <Leaf className="w-3 h-3" /> Creatina
            </span>
            <span className="text-xs font-mono font-black text-white block mt-0.5">{weeklyHabits.creatineDays}/7 d</span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. PROGRESIÓN DE FUERZA (BÓVEDA DE RÉCORDS)                    */}
      {/* ============================================================== */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-bold block">
              RÉCORDS PERSONALES
            </span>
            <h3 className="text-lg font-bold text-white mt-0.5">
              Progresión de fuerza
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setShowAllPRs(!showAllPRs)}
            className="px-2.5 py-1 rounded-full text-[10px] font-mono font-black uppercase tracking-wider bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25 active:scale-95 transition"
          >
            {showAllPRs ? 'Ver menos' : `Ver todos (${prList.length})`}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {displayedPRs.map((pr) => (
            <div
              key={pr.exId}
              onClick={() => setActivePR(pr)}
              className="p-3.5 rounded-3xl bg-[#141419] border border-transparent hover:border-rose-500/30 active:scale-95 transition cursor-pointer relative overflow-hidden"
            >
              <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-rose-400 uppercase tracking-wider mb-1">
                <Flame className="w-3.5 h-3.5 fill-rose-500/40 text-rose-500" />
                <span>RÉCORD PR</span>
              </div>

              <h4 className="text-xs font-bold text-white truncate mb-1">
                {pr.name}
              </h4>

              <div className="flex items-baseline gap-1">
                <span className="text-xl font-mono font-black text-white">
                  {pr.weight}
                </span>
                <span className="text-xs font-mono text-zinc-400 font-bold">kg</span>
                <span className="text-[10px] font-mono text-zinc-500 ml-1">× {pr.reps}</span>
              </div>

              <span className="text-[10px] font-mono text-emerald-400 block mt-1">
                e1RM: {pr.e1rm} kg
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* PR Detail Modal */}
      {activePR && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setActivePR(null)}
        >
          <div
            className="w-full max-w-sm bg-[#141419] border border-transparent rounded-3xl p-5 text-white shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-3">
              <Award className="w-6 h-6 stroke-[2.5]" />
            </div>

            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 font-bold block">
              BÓVEDA DE RÉCORDS PERSONALES
            </span>
            <h3 className="text-lg font-black text-white mt-0.5">
              {activePR.name}
            </h3>

            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="p-3 rounded-2xl bg-black/40 border border-transparent">
                <span className="text-[9px] font-mono text-zinc-400 uppercase block">Récord de Carga</span>
                <span className="text-2xl font-mono font-black text-white">{activePR.weight} <span className="text-xs text-zinc-500">kg</span></span>
                <span className="text-[10px] font-mono text-rose-400 block mt-0.5">{activePR.reps} reps logradas</span>
              </div>
              <div className="p-3 rounded-2xl bg-black/40 border border-transparent">
                <span className="text-[9px] font-mono text-zinc-400 uppercase block">1RM Estimado</span>
                <span className="text-2xl font-mono font-black text-emerald-400">{activePR.e1rm} <span className="text-xs text-zinc-500">kg</span></span>
                <span className="text-[10px] font-mono text-zinc-400 block mt-0.5">{activePR.date || 'Ciclo actual'}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActivePR(null)}
              className="w-full mt-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 active:scale-95 text-white font-mono text-xs font-bold transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. SESIONES REGISTRADAS: CONTRAER / EXPANDIR IN-PLACE          */}
      {/* ============================================================== */}
      <div>
        <div className="mb-2.5 px-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-bold block">
            HISTÓRICO DE SESIONES
          </span>
          <h3 className="text-lg font-bold text-white mt-0.5">
            {sessions.length} entrenamientos registrados
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Toca cualquier entrenamiento para expandir sus series y ejercicios.
          </p>
        </div>

        <div className="space-y-2.5">
          {(showAllSessions ? sessions : sessions.slice(0, 4)).map((s) => {
            const isExpanded = expandedSessionDate === s.date;
            const exEntries = Object.entries(s.exercisesData || {});

            return (
              <div
                key={s.date}
                className="rounded-3xl bg-[#121217] border border-transparent overflow-hidden transition-all shadow-sm"
              >
                {/* Header Strip - Click to expand / collapse */}
                <div
                  onClick={() => setExpandedSessionDate(isExpanded ? null : s.date)}
                  className="p-3.5 sm:p-4 hover:bg-white/[0.03] transition-all cursor-pointer flex items-center justify-between gap-3 active:scale-98"
                >
                  {/* Date box */}
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-transparent flex flex-col items-center justify-center shrink-0">
                    <span className="text-[9px] font-mono uppercase font-bold text-zinc-400">
                      {s.dayShort}
                    </span>
                    <span className="text-sm font-mono font-black text-white">
                      {s.dayNum}
                    </span>
                  </div>

                  {/* Title & volume */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm sm:text-base font-bold text-white truncate">
                      {s.sessionName.split(' — ')[0] || s.sessionName}
                    </h4>
                    <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
                      {s.setsCount} series · {s.exercisesCount} ejercicios · {s.volume > 0 ? `${s.volume.toLocaleString()} kg` : 'Completado'}
                    </p>
                  </div>

                  {/* Chevron Toggle */}
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] font-mono font-bold text-zinc-400 hidden sm:inline">
                      {isExpanded ? 'Contraer' : 'Ver detalle'}
                    </span>
                    <div className={`p-1.5 rounded-full bg-white/5 transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-rose-500/20 text-rose-300' : 'text-zinc-400'}`}>
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* Expanded In-Place Workout Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-transparent bg-black/40 space-y-3 animate-fade-in">
                    {/* Summary row */}
                    <div className="flex items-center justify-between text-xs font-mono text-zinc-400 py-1 border-b border-transparent">
                      <span>{s.date} · {s.sessionName}</span>
                      <span className="font-bold text-emerald-400">{s.volume.toLocaleString()} kg totales</span>
                    </div>

                    {/* Exercises breakdown */}
                    <div className="space-y-2.5">
                      {exEntries.map(([exId, sets]) => {
                        const exName = prs[exId]?.exerciseName || exId.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

                        return (
                          <div key={exId} className="p-3 rounded-2xl bg-white/[0.02] border border-transparent">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-white truncate">
                                {exName}
                              </span>
                              <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                                {sets.length} series
                              </span>
                            </div>

                            {/* Sets pills */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                              {sets.map((set, sIdx) => (
                                <div
                                  key={sIdx}
                                  className={`p-2 rounded-xl border flex items-center justify-between text-[11px] font-mono ${
                                    set.isPr
                                      ? 'bg-rose-500/15 border-rose-500/35 text-white'
                                      : 'bg-black/60 border-transparent text-zinc-300'
                                  }`}
                                >
                                  <span className="text-zinc-400">#{sIdx + 1}</span>
                                  <span className="font-bold text-white">{set.weight}kg × {set.reps}</span>
                                  {set.isPr ? (
                                    <span className="text-[9px] font-black uppercase text-rose-400 bg-rose-500/20 px-1 rounded">PR</span>
                                  ) : (
                                    <span className="text-[9px] text-zinc-400">RIR {set.rir ?? '-'}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Action to open in full Workout editor */}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => onSelectSession && onSelectSession(s.date)}
                        className="w-full py-2.5 rounded-xl bg-white/[0.06] hover:bg-viltrum-crimson hover:text-white active:scale-95 text-xs font-mono font-bold text-zinc-300 transition flex items-center justify-center gap-1.5 border border-transparent"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Abrir sesión completa en pestaña Entreno</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Toggle between 4 workouts and all workouts */}
        {sessions.length > 4 && (
          <button
            type="button"
            onClick={() => setShowAllSessions(!showAllSessions)}
            className="w-full mt-3 py-3.5 px-4 rounded-2xl bg-[#141419] hover:bg-[#1a1a22] active:scale-98 border border-transparent text-white font-mono text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
          >
            {showAllSessions ? (
              <>
                <ChevronUp className="w-4 h-4 text-rose-400" />
                <span>Mostrar menos (ver solo los 4 más recientes)</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 text-rose-400" />
                <span>Ver todos los entrenamientos ({sessions.length - 4} más)</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
