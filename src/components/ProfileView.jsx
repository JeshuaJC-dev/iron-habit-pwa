import React, { useState, useEffect } from 'react';
import { User, Shield, Zap, Smartphone, Bell, ChevronRight, Award, RefreshCw, Download, Upload, X, Check } from 'lucide-react';

const DEFAULT_PROFILE = {
  name: 'Alex Moreno',
  programVersion: 'v3.3',
  height: 191,
  currentWeight: 76.0,
  targetWeight: 80.0,
  goal: 'Hipertrofia & Volumen Limpio (3.100 kcal)',
  occupation: 'Prácticas mañanas & Estudio tardes',
  rirBase: '1-2',
  increment: '2.5 kg',
};

export default function ProfileView({
  totalSessions = 0,
  totalRecords = 0,
  totalKgMoved = 0,
  latestWeight = 76.0,
  routineProfile = null,
  onSyncObsidian,
  isSyncingObsidian = false,
  onOpenVault,
  onSaveBodyweight,
  onOpenRir,
  onOpenMobility
}) {
  const [profile, setProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('habito_athlete_profile');
      const base = saved ? { ...DEFAULT_PROFILE, ...JSON.parse(saved) } : DEFAULT_PROFILE;
      if (latestWeight && (!saved || !JSON.parse(saved).currentWeight)) {
        base.currentWeight = latestWeight;
      }
      return base;
    } catch {
      return DEFAULT_PROFILE;
    }
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(profile);

  const [hapticEnabled, setHapticEnabled] = useState(() => {
    return localStorage.getItem('habito_haptic') !== 'false';
  });

  const [autoRestEnabled, setAutoRestEnabled] = useState(() => {
    return localStorage.getItem('habito_autorest') !== 'false';
  });

  const toggleHaptic = () => {
    const next = !hapticEnabled;
    setHapticEnabled(next);
    localStorage.setItem('habito_haptic', String(next));
  };

  const toggleAutoRest = () => {
    const next = !autoRestEnabled;
    setAutoRestEnabled(next);
    localStorage.setItem('habito_autorest', String(next));
  };

  const toggleIncrement = () => {
    const nextInc = profile.increment === '2.5 kg' ? '1.25 kg' : '2.5 kg';
    const updated = { ...profile, increment: nextInc };
    setProfile(updated);
    localStorage.setItem('habito_athlete_profile', JSON.stringify(updated));
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    setProfile(editForm);
    localStorage.setItem('habito_athlete_profile', JSON.stringify(editForm));
    if (onSaveBodyweight && editForm.currentWeight > 0) {
      onSaveBodyweight(editForm.currentWeight);
    }
    setIsEditing(false);
  };

  // Real tonnage in tons
  const totalTons = (totalKgMoved / 1000).toFixed(1);

  // Weight progression percentage towards goal (e.g. from 75 to 80 kg)
  const weightProgressPercent = Math.min(
    100,
    Math.max(10, Math.round(((profile.currentWeight - 75) / (profile.targetWeight - 75)) * 100))
  ) || 45;

  return (
    <div className="space-y-4 pb-32 animate-fade-in select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <span className="text-[11px] font-mono font-bold tracking-widest text-viltrum-crimson uppercase">
            ATLETA · RUTINA THRAGG {profile.programVersion}
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-0.5">
            Tu perfil
          </h1>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditForm(profile);
            setIsEditing(true);
          }}
          className="px-3.5 py-1.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] active:scale-95 border border-transparent text-xs font-mono font-bold text-zinc-300 transition"
        >
          Editar
        </button>
      </div>

      {/* USER PROFILE HEADER CARD */}
      <div className="p-4 sm:p-5 rounded-3xl bg-[#121217] border border-white/[0.07] relative overflow-hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-950 to-viltrum-crimson border border-rose-500/40 flex items-center justify-center text-white font-mono font-black text-lg shadow-md shrink-0">
              {profile.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>

            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                {profile.name}
              </h3>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                191 cm · {profile.occupation || 'Camarero activo'}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-[10px] font-mono uppercase font-bold text-emerald-400 tracking-wider">
                  TORSO / PIERNA (4 DÍAS)
                </span>
              </div>
            </div>
          </div>

          {/* Program Version Badge */}
          <div className="text-right shrink-0">
            <span className="text-xl font-mono font-black text-rose-400 block">
              {profile.programVersion}
            </span>
            <span className="text-[9px] font-mono uppercase font-bold tracking-widest text-zinc-500">
              PROGRAMA
            </span>
          </div>
        </div>
      </div>

      {/* 3 QUICK STATS TILES (100% REAL DATA FROM DB) */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="p-3.5 rounded-3xl bg-[#121217] border border-transparent text-center">
          <span className="text-xl font-mono font-black text-white block">
            {totalSessions}
          </span>
          <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 font-bold mt-0.5 block">
            SESIONES
          </span>
        </div>

        <div className="p-3.5 rounded-3xl bg-[#121217] border border-transparent text-center">
          <div className="flex items-baseline justify-center gap-0.5">
            <span className="text-xl font-mono font-black text-white">
              {totalTons}
            </span>
            <span className="text-[10px] font-mono font-bold text-amber-400">t</span>
          </div>
          <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 font-bold mt-0.5 block">
            VOLUMEN TOTAL
          </span>
        </div>

        <div className="p-3.5 rounded-3xl bg-[#121217] border border-transparent text-center">
          <span className="text-xl font-mono font-black text-white block">
            {totalRecords}
          </span>
          <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 font-bold mt-0.5 block">
            RÉCORDS (PR)
          </span>
        </div>
      </div>

      {/* OBJETIVO ACTUAL */}
      <div className="p-4 sm:p-5 rounded-3xl bg-[#121217] border border-white/[0.07]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold">
            OBJETIVO ACTUAL
          </span>
          <span className="text-xs font-mono font-black text-amber-400">
            {weightProgressPercent}%
          </span>
        </div>

        <h4 className="text-sm sm:text-base font-bold text-white mb-2">
          {profile.goal}
        </h4>

        {/* Progress bar */}
        <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden mb-2">
          <div 
            className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-500" 
            style={{ width: `${weightProgressPercent}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
          <span>Bloque Hipertrofia · {totalSessions} sesiones</span>
          <span>{profile.currentWeight} kg → {profile.targetWeight} kg</span>
        </div>
      </div>

      {/* EXPERIENCIA DE ENTRENO / PREFERENCIAS */}
      <div className="p-4 rounded-3xl bg-[#121217] border border-white/[0.07] space-y-3">
        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-bold block mb-1">
          EXPERIENCIA DE ENTRENO · Preferencias rápidas
        </span>

        {/* Haptic toggle */}
        <div className="flex items-center justify-between py-1.5 border-b border-transparent">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Zap className="w-4 h-4 fill-rose-500/40" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">Respuesta háptica</span>
              <span className="text-[10px] text-zinc-400">Confirmación física al completar</span>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleHaptic}
            className={`w-11 h-6 rounded-full transition-colors relative ${hapticEnabled ? 'bg-apple-green' : 'bg-white/10'}`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${hapticEnabled ? 'left-5' : 'left-0.5'}`}
            />
          </button>
        </div>

        {/* Auto rest toggle */}
        <div className="flex items-center justify-between py-1.5 border-b border-transparent">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">Descanso automático</span>
              <span className="text-[10px] text-zinc-400">Iniciar al marcar cada serie</span>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleAutoRest}
            className={`w-11 h-6 rounded-full transition-colors relative ${autoRestEnabled ? 'bg-apple-green' : 'bg-white/10'}`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${autoRestEnabled ? 'left-5' : 'left-0.5'}`}
            />
          </button>
        </div>

        {/* Weight increments toggle */}
        <div
          onClick={toggleIncrement}
          className="flex items-center justify-between py-1.5 cursor-pointer hover:bg-white/[0.02] rounded-xl px-1 transition active:scale-98"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-mono font-bold text-xs">
              kg
            </div>
            <div>
              <span className="text-xs font-bold text-white block">Incrementos de carga</span>
              <span className="text-[10px] text-zinc-400">Toca para alternar (1.25 / 2.5 kg)</span>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-xl bg-white/5 border border-transparent font-mono text-xs font-bold text-white">
            {profile.increment}
          </span>
        </div>
      </div>

      {/* ANTHROPOMETRIC STRIP */}
      <div className="grid grid-cols-3 gap-2.5 p-3 rounded-2xl bg-[#0f0f13] border border-transparent text-center text-xs font-mono">
        <div>
          <span className="text-[9px] uppercase text-zinc-500 block">PESO ACTUAL</span>
          <span className="font-bold text-white">{profile.currentWeight} kg</span>
        </div>
        <div className="border-x border-transparent">
          <span className="text-[9px] uppercase text-zinc-500 block">ALTURA</span>
          <span className="font-bold text-white">{profile.height} cm</span>
        </div>
        <div>
          <span className="text-[9px] uppercase text-zinc-500 block">RIR BASE</span>
          <span className="font-bold text-white">{profile.rirBase}</span>
        </div>
      </div>

      {/* GUÍAS RÁPIDAS (RIR & MOVILIDAD) */}
      {(onOpenRir || onOpenMobility) && (
        <div className="grid grid-cols-2 gap-2.5">
          {onOpenRir && (
            <button
              type="button"
              onClick={onOpenRir}
              className="p-3.5 rounded-2xl bg-[#121217] hover:bg-white/[0.05] active:scale-[0.98] text-left transition"
            >
              <span className="text-[10px] font-mono uppercase tracking-wider text-rose-400 font-bold block">
                Referencia
              </span>
              <span className="text-xs font-bold text-white block mt-0.5">
                Guía de RIR
              </span>
            </button>
          )}
          {onOpenMobility && (
            <button
              type="button"
              onClick={onOpenMobility}
              className="p-3.5 rounded-2xl bg-[#121217] hover:bg-white/[0.05] active:scale-[0.98] text-left transition"
            >
              <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold block">
                Protocolo 191 cm
              </span>
              <span className="text-xs font-bold text-white block mt-0.5">
                Movilidad &amp; Warmup
              </span>
            </button>
          )}
        </div>
      )}

      {/* OBSIDIAN SYNC & VAULT BACKUP */}
      <div className="p-4 rounded-3xl bg-[#121217] border border-white/[0.07] space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-bold text-white">Bóveda de Seguridad & Obsidian</span>
          </div>

          <button
            type="button"
            onClick={onSyncObsidian}
            disabled={isSyncingObsidian}
            className="px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 font-mono text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingObsidian ? 'animate-spin' : ''}`} />
            <span>{isSyncingObsidian ? 'Sincronizando...' : 'Sync Vault'}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenVault}
          className="w-full py-2.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 font-mono text-xs border border-transparent flex items-center justify-center gap-2 transition"
        >
          <span>Abrir Bóveda de Backups (Snapshots & Restauración)</span>
        </button>
      </div>

      {/* EDIT PROFILE MODAL */}
      {isEditing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsEditing(false)}
        >
          <div
            className="w-full max-w-sm bg-[#141419] border border-transparent rounded-3xl p-5 text-white shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold text-white">Editar Perfil</h3>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3">
              <div>
                <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">Nombre</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full bg-black/60 border border-transparent rounded-xl px-3 py-2 text-white font-mono text-sm focus:border-rose-500 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">Peso Actual (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.currentWeight}
                    onChange={(e) => setEditForm({ ...editForm, currentWeight: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-black/60 border border-transparent rounded-xl px-3 py-2 text-white font-mono text-sm focus:border-rose-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">Peso Objetivo (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.targetWeight}
                    onChange={(e) => setEditForm({ ...editForm, targetWeight: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-black/60 border border-transparent rounded-xl px-3 py-2 text-white font-mono text-sm focus:border-rose-500 outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">Objetivo / Enfoque</label>
                <input
                  type="text"
                  value={editForm.goal}
                  onChange={(e) => setEditForm({ ...editForm, goal: e.target.value })}
                  className="w-full bg-black/60 border border-transparent rounded-xl px-3 py-2 text-white text-xs focus:border-rose-500 outline-none"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono font-bold text-zinc-400 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-viltrum-crimson hover:bg-rose-600 text-xs font-mono font-bold text-white transition shadow-lg shadow-rose-950/50"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
