import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { useUiStore } from '../../store/uiStore';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useUiStore();

  if (toasts.length === 0) return null;

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
    info: <Info className="w-5 h-5 text-blue-500 shrink-0" />,
  };

  const borders = {
    success: 'border-emerald-500/30 bg-white dark:bg-stone-900',
    error: 'border-red-500/30 bg-white dark:bg-stone-900',
    warning: 'border-amber-500/30 bg-white dark:bg-stone-900',
    info: 'border-blue-500/30 bg-white dark:bg-stone-900',
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center justify-between p-4 rounded-2xl shadow-xl border ${
            borders[t.type]
          } transition-all animate-in slide-in-from-bottom-2 duration-200`}
        >
          <div className="flex items-center gap-3">
            {icons[t.type]}
            <p className="text-sm font-medium text-stone-900 dark:text-stone-100">
              {t.message}
            </p>
          </div>
          <button
            onClick={() => removeToast(t.id)}
            className="p-1 ml-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-lg"
            aria-label="Tutup notifikasi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
