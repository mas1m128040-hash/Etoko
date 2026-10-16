import React from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { useVersionCheck, isVersionCheckDisabled } from '../../hooks/useVersionCheck';

export const VersionNotificationBanner: React.FC = () => {
  const { newVersionAvailable, reloadApp } = useVersionCheck();

  if (isVersionCheckDisabled() || !newVersionAvailable) return null;

  return (
    <aside
      aria-label="Pembaruan Aplikasi Tersedia"
      role="banner"
      onClick={reloadApp}
      className="sticky top-0 z-40 w-full bg-linear-to-r from-orange-600 via-[#FF6B1A] to-amber-600 text-white shadow-md cursor-pointer hover:brightness-105 active:scale-[0.99] transition-all select-none border-b border-orange-700/30"
    >
      <div className="max-w-7xl mx-auto px-3 py-2 flex items-center justify-between gap-2 text-xs sm:text-sm font-bold">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-amber-200 shrink-0 animate-pulse" />
          <span className="truncate">Versi baru tersedia - ketuk untuk memperbarui</span>
        </div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-black shrink-0 transition-colors shadow-xs">
          <RefreshCw className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Perbarui</span>
        </div>
      </div>
    </aside>
  );
};
