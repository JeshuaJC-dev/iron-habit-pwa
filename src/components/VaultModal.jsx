import React, { useState } from 'react';
import { X, Download, Upload, RefreshCw, Shield, CheckCircle, Database, FileText } from 'lucide-react';
import { getTodayLocal } from '../utils/date';

export default function VaultModal({
  isOpen,
  onClose,
  onSyncObsidian,
  isSyncingObsidian,
  onRestoreBackup,
  showToast
}) {
  const [isRestoring, setIsRestoring] = useState(false);

  if (!isOpen) return null;

  const handleDownloadBackup = async () => {
    try {
      const res = await fetch('/api/backup');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `thragg-backup-${getTodayLocal()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Copia de seguridad descargada con éxito', 'check');
    } catch (err) {
      showToast('Error al descargar copia de seguridad', 'error');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsRestoring(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target.result);
        await onRestoreBackup(json);
        showToast('¡Copia de seguridad restaurada correctamente!', 'check');
        onClose();
      } catch (err) {
        showToast('Archivo JSON no válido', 'error');
      } finally {
        setIsRestoring(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-md animate-fade-in-backdrop"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md h-full bg-[#0e0e13]/95 backdrop-blur-2xl border-l border-viltrum-crimson/30 shadow-2xl flex flex-col p-5 sm:p-6 animate-slide-in-right overflow-y-auto pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-[calc(env(safe-area-inset-bottom,0px)+2rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-transparent mb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-viltrum-crimson animate-ping" />
              <h3 className="text-lg font-bold text-white tracking-tight">
                Bóveda & Copias de Seguridad
              </h3>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">Persistencia y exportación de entrenamientos</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/6 hover:bg-white/12 text-zinc-400 hover:text-white flex items-center justify-center transition active:scale-90"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 flex-1">
          {/* Status Badge */}
          <div className="p-3.5 rounded-apple-sm bg-apple-green/10 border border-apple-green/25 space-y-1.5">
            <div className="flex items-center gap-2 text-apple-green text-xs font-bold">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>Guardado en Móvil Activado (LocalStorage)</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Tus entrenos y hábitos se guardan automáticamente en la memoria de tu móvil y en el servidor. Nunca se pierden aunque se reinicie la conexión.
            </p>
          </div>

          {/* Action 1: Obsidian Export */}
          <div className="p-4 rounded-apple-sm bg-white/4 border border-transparent space-y-2.5">
            <div className="flex items-center gap-2 text-white font-semibold text-sm">
              <FileText className="w-4 h-4 text-viltrum-crimson" />
              <span>Sincronizar Bóveda Obsidian</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Convierte todos tus entrenamientos y hábitos en notas Markdown en tu carpeta de Obsidian (PC).
            </p>
            <button
              onClick={onSyncObsidian}
              disabled={isSyncingObsidian}
              className="w-full py-2.5 px-3 rounded-apple-sm bg-viltrum-crimson hover:bg-rose-700 text-white font-bold text-xs transition active:scale-98 flex items-center justify-center gap-2 shadow-lg shadow-rose-950/50 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingObsidian ? 'animate-spin' : ''}`} />
              <span>{isSyncingObsidian ? 'Sincronizando...' : 'Exportar a Obsidian'}</span>
            </button>
          </div>

          {/* Action 2: Download JSON Backup */}
          <div className="p-4 rounded-apple-sm bg-white/4 border border-transparent space-y-2.5">
            <div className="flex items-center gap-2 text-white font-semibold text-sm">
              <Download className="w-4 h-4 text-apple-blue" />
              <span>Descargar Copia de Seguridad (JSON)</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Descarga un archivo con toda tu base de datos completa (series, pesos, PRs y hábitos). Puedes guardarlo en tu móvil o enviártelo por WhatsApp/Drive.
            </p>
            <button
              onClick={handleDownloadBackup}
              className="w-full py-2.5 px-3 rounded-apple-sm bg-white/10 hover:bg-white/15 text-white font-semibold text-xs transition active:scale-98 flex items-center justify-center gap-2 border border-transparent"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar Archivo JSON</span>
            </button>
          </div>

          {/* Action 3: Restore JSON Backup */}
          <div className="p-4 rounded-apple-sm bg-white/4 border border-transparent space-y-2.5">
            <div className="flex items-center gap-2 text-white font-semibold text-sm">
              <Upload className="w-4 h-4 text-amber-400" />
              <span>Restaurar Copia de Seguridad</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Si cambias de teléfono o quieres restaurar un archivo de copia anterior, súbelo aquí para recuperar todas tus sesiones.
            </p>
            <label className="w-full py-2.5 px-3 rounded-apple-sm bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-semibold text-xs transition active:scale-98 flex items-center justify-center gap-2 border border-dashed border-white/20 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>{isRestoring ? 'Restaurando...' : 'Seleccionar Archivo JSON'}</span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isRestoring}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
