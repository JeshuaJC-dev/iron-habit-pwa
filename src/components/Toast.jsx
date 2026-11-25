import React from 'react';
import { Check, AlertCircle, Award, Sparkles, RefreshCw } from 'lucide-react';

export default function Toast({ toast }) {
  if (!toast || !toast.show) return null;

  const getIcon = () => {
    switch (toast.type) {
      case 'award':
        return <Award className="w-4 h-4 text-apple-orange animate-bounce" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-apple-red" />;
      case 'sync':
        return <RefreshCw className="w-4 h-4 text-apple-purple animate-spin" />;
      default:
        return <Check className="w-4 h-4 text-apple-green" />;
    }
  };

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-slide-down">
      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-apple-pill bg-black/90 backdrop-blur-2xl border border-white/20 text-white shadow-2xl shadow-black/80 font-sans text-xs font-semibold">
        {getIcon()}
        <span>{toast.message}</span>
      </div>
    </div>
  );
}
