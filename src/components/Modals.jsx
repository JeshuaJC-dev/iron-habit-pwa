import React from 'react';
import { X, AlertTriangle, ShieldCheck, Footprints, Sunrise, Sunset } from 'lucide-react';

export function RirModal({ isOpen, onClose, rirGuide = [] }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-md animate-fade-in-backdrop"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md h-full bg-[#0e0e13]/95 backdrop-blur-2xl border-l border-viltrum-crimson/30 shadow-2xl flex flex-col p-5 sm:p-6 animate-slide-in-right overflow-y-auto pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-[calc(env(safe-area-inset-bottom,0px)+2rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-apple-orange animate-ping" />
              <h3 className="text-lg font-bold text-white tracking-tight">
                Guía de Intensidad & RIR
              </h3>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">Repeticiones en Reserva para hipertrofia y seguridad</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/6 hover:bg-white/12 text-zinc-400 hover:text-white flex items-center justify-center transition active:scale-90"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3.5 flex-1">
          {rirGuide.map((item, idx) => (
            <div
              key={idx}
              className="bg-white/4 border border-white/8 rounded-apple-sm p-3.5 space-y-1.5 transition hover:border-viltrum-crimson/30"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-sm text-apple-red">
                  {item.rir}
                </span>
                <span className="text-xs font-semibold text-zinc-300">
                  {item.intensity}
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                <strong className="text-zinc-200">Cuándo usar:</strong> {item.when}
              </p>
              <div
                className={`text-[11px] leading-relaxed p-2.5 rounded-apple-sm flex items-start gap-1.5 ${
                  item.warning.includes('NUNCA')
                    ? 'bg-apple-red/10 text-apple-red border border-apple-red/20'
                    : 'bg-apple-orange/10 text-apple-orange border border-apple-orange/20'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{item.warning}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MobilityModal({ isOpen, onClose, mobilityData }) {
  if (!isOpen || !mobilityData) return null;

  const { morning, night, upperWarmup, legWarmup } = mobilityData;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-md animate-fade-in-backdrop"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md h-full bg-[#0e0e13]/95 backdrop-blur-2xl border-l border-viltrum-crimson/30 shadow-2xl flex flex-col p-5 sm:p-6 animate-slide-in-right overflow-y-auto pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-[calc(env(safe-area-inset-bottom,0px)+2rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-viltrum-crimson animate-ping" />
              <h3 className="text-lg font-bold text-white tracking-tight">
                Armadura & Movilidad (191 cm)
              </h3>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">Protocolo rotuliano y descompresión articular</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/6 hover:bg-white/12 text-zinc-400 hover:text-white flex items-center justify-center transition active:scale-90"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 flex-1">
          {/* Morning */}
          {morning && (
            <div className="bg-white/4 border border-white/8 rounded-apple-sm p-4 space-y-2">
              <h4 className="text-xs font-bold text-apple-cyan uppercase tracking-wider flex items-center gap-1.5">
                <Sunrise className="w-4 h-4" /> Rutina Mañana ({morning.duration})
              </h4>
              <ul className="space-y-2 text-xs text-zinc-300">
                {morning.items?.map((it, idx) => (
                  <li key={idx} className="flex flex-col border-b border-white/5 pb-1.5 last:border-0 last:pb-0">
                    <span className="font-semibold text-white">
                      • {it.name} <span className="font-mono text-zinc-400 font-normal">({it.sets})</span>
                    </span>
                    <span className="text-[11px] text-zinc-400 pl-3">{it.notes}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Night */}
          {night && (
            <div className="bg-white/4 border border-white/8 rounded-apple-sm p-4 space-y-2">
              <h4 className="text-xs font-bold text-apple-purple uppercase tracking-wider flex items-center gap-1.5">
                <Sunset className="w-4 h-4" /> Rutina Noche ({night.duration})
              </h4>
              <ul className="space-y-2 text-xs text-zinc-300">
                {night.items?.map((it, idx) => (
                  <li key={idx} className="flex flex-col border-b border-white/5 pb-1.5 last:border-0 last:pb-0">
                    <span className="font-semibold text-white">
                      • {it.name} <span className="font-mono text-zinc-400 font-normal">({it.sets})</span>
                    </span>
                    <span className="text-[11px] text-zinc-400 pl-3">{it.notes}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Upper Warmup */}
          {upperWarmup && (
            <div className="bg-white/4 border border-white/8 rounded-apple-sm p-4 space-y-2">
              <h4 className="text-xs font-bold text-apple-green uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> Calentamiento Pre-Torso ({upperWarmup.duration})
              </h4>
              <ul className="space-y-2 text-xs text-zinc-300">
                {upperWarmup.items?.map((it, idx) => (
                  <li key={idx} className="flex flex-col border-b border-white/5 pb-1.5 last:border-0 last:pb-0">
                    <span className="font-semibold text-white">
                      • {it.name} <span className="font-mono text-zinc-400 font-normal">({it.sets})</span>
                    </span>
                    <span className="text-[11px] text-zinc-400 pl-3">{it.notes}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Leg Warmup */}
          {legWarmup && (
            <div className="bg-white/4 border border-white/8 rounded-apple-sm p-4 space-y-2">
              <h4 className="text-xs font-bold text-apple-orange uppercase tracking-wider flex items-center gap-1.5">
                <Footprints className="w-4 h-4" /> Calentamiento Pre-Pierna ({legWarmup.duration})
              </h4>
              <ul className="space-y-2 text-xs text-zinc-300">
                {legWarmup.items?.map((it, idx) => (
                  <li key={idx} className="flex flex-col border-b border-white/5 pb-1.5 last:border-0 last:pb-0">
                    <span className="font-semibold text-white">
                      • {it.name} <span className="font-mono text-zinc-400 font-normal">({it.sets})</span>
                    </span>
                    <span className="text-[11px] text-zinc-400 pl-3">{it.notes}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
