import React from 'react';
import {
  Wifi,
  WifiOff,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  LogOut,
  Menu as MenuIcon,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useConnectionStatus } from '../../hooks/useConnectionStatus';
import { useSoundStore } from '../../store/soundStore';
import { useUiStore } from '../../store/uiStore';
import { useSettings } from '../../hooks/useSettings';
import { USER_ROLE_LABELS } from '../../config/constants';

interface TopBarProps {
  onToggleSidebar?: () => void;
  title?: string;
  wakeLockActive?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  onToggleSidebar,
  title,
  wakeLockActive = false,
}) => {
  const { restaurantName } = useSettings();
  const displayTitle = title || restaurantName;
  const { profile, signOut } = useAuth();
  const { isOnline } = useConnectionStatus();
  const { soundEnabled, setSoundEnabled, isCurrentlyMuted, muteTemporarily, unmuteNow } =
    useSoundStore();
  const { theme, toggleTheme } = useUiStore();

  const isMuted = isCurrentlyMuted();

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#141414]/95 backdrop-blur-md border-b border-stone-200 dark:border-stone-800 px-4 sm:px-6 py-3">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Hamburger & Page Title */}
        <div className="flex items-center gap-3">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl cursor-pointer"
              aria-label="Buka menu navigasi"
            >
              <MenuIcon className="w-5 h-5" />
            </button>
          )}

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
                <span>{displayTitle}</span>
              </h1>
              {displayTitle !== restaurantName && (
                <span className="hidden sm:inline-block text-xs font-semibold px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                  {restaurantName}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Status Indicators & Quick Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Firestore Online/Offline Status Indicator */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
              isOnline
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 animate-pulse'
            }`}
            title={
              isOnline
                ? 'Firestore terhubung & tersinkronisasi'
                : 'Koneksi Firestore terputus (Offline)'
            }
          >
            {isOnline ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <Wifi className="w-3.5 h-3.5" />
                <span className="font-bold">Firestore: Online</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <WifiOff className="w-3.5 h-3.5" />
                <span className="font-bold">Firestore: Offline</span>
              </>
            )}
          </div>

          {/* Screen WakeLock Indicator */}
          {wakeLockActive && (
            <div
              className="hidden md:flex items-center gap-1 px-2 py-1 rounded-md bg-stone-100 dark:bg-stone-800 text-[11px] font-medium text-stone-600 dark:text-stone-300"
              title="Layar dijaga agar tidak mati otomatis"
            >
              <Sun className="w-3 h-3 text-amber-500" />
              <span>Layar Terjaga</span>
            </div>
          )}

          {/* Sound Mute / Unmute Toggle */}
          <button
            onClick={() => {
              if (isMuted) {
                unmuteNow();
              } else {
                muteTemporarily(5); // mute 5 minutes
              }
            }}
            className={`min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl transition-colors cursor-pointer ${
              isMuted || !soundEnabled
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
            title={
              isMuted
                ? 'Alarm sedang dimute (Ketuk untuk bunyikan)'
                : 'Mute alarm sementara selama 5 menit'
            }
            aria-label="Pengaturan suara"
          >
            {isMuted || !soundEnabled ? (
              <VolumeX className="w-5 h-5" />
            ) : (
              <Volume2 className="w-5 h-5 text-[#FF6B1A]" />
            )}
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors cursor-pointer"
            title={theme === 'dark' ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
            aria-label="Ganti tema"
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 text-amber-400" />
            ) : (
              <Moon className="w-5 h-5 text-stone-600" />
            )}
          </button>

          {/* Staff Profile & Logout */}
          {profile && (
            <div className="flex items-center gap-2 pl-2 border-l border-stone-200 dark:border-stone-800">
              <div className="hidden sm:block text-right">
                <p className="text-xs font-bold text-stone-900 dark:text-stone-100 leading-none">
                  {profile.name}
                </p>
                <span className="text-[10px] font-semibold text-[#FF6B1A] uppercase tracking-wider">
                  {USER_ROLE_LABELS[profile.role]}
                </span>
              </div>

              <button
                onClick={signOut}
                className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors"
                title="Keluar (Logout)"
                aria-label="Keluar"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
