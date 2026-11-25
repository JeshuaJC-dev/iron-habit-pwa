import React from 'react';
import { LayoutGrid, Dumbbell, History, User } from 'lucide-react';

export default function BottomNavBar({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'plan', label: 'PLAN', icon: LayoutGrid },
    { id: 'workout', label: 'ENTRENO', icon: Dumbbell },
    { id: 'history', label: 'HISTORIAL', icon: History },
    { id: 'profile', label: 'PERFIL', icon: User },
  ];

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#09090c]/95 backdrop-blur-2xl border-t border-white/[0.08] px-4 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] select-none"
    >
      <div className="max-w-md mx-auto grid grid-cols-4 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center py-1.5 transition-all relative ${
                isActive
                  ? 'text-viltrum-crimson'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 stroke-[2.5]' : 'stroke-[1.8]'}`} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-viltrum-crimson rounded-full" />
                )}
              </div>
              <span className={`text-[10px] font-mono tracking-wider mt-1.5 font-bold ${isActive ? 'text-viltrum-crimson' : 'text-zinc-500'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
