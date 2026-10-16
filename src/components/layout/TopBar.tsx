import React, { useState, useRef, useEffect } from 'react';
import {
  Sun,
  Moon,
  Volume2,
  VolumeX,
  LogOut,
  Menu as MenuIcon,
  User,
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

function getShortTitle(fullTitle?: string): string {
  if (!fullTitle) return 'Dashboard';
  const upper = fullTitle.toUpperCase();
  if (upper.includes('DASHBOARD')) return 'Dashboard';
  if (upper.includes('MENU')) return 'Menu';
  if (upper.includes('LAPORAN')) return 'Laporan';
  if (upper.includes('QR')) return 'QR Meja';
  if (upper.includes('PENGATURAN')) return 'Pengaturan';
  return fullTitle;
}

export const TopBar: React.FC<TopBarProps> = ({
  onToggleSidebar,
  title,
  wakeLockActive = false,
}) => {
  const { restaurantName } = useSettings();
  const displayTitle = title || restaurantName;
  const shortTitle = getShortTitle(title);
  const { profile, signOut } = useAuth();
  const { isOnline } = useConnectionStatus();
  const { soundEnabled, isCurrentlyMuted, muteTemporarily, unmuteNow } =
    useSoundStore();
  const { theme, toggleTheme } = useUiStore();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const isMuted = isCurrentlyMuted();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [userMenuOpen]);

  const initialLetter = (profile?.name?.trim()?.[0] || 'A').toUpperCase();

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#141414]/95 backdrop-blur-md border-b border-stone-200 dark:border-stone-800 px-3 sm:px-6 py-2.5 sm:py-3">
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Hamburger & Page Title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="lg:hidden min-h-[40px] min-w-[40px] flex items-center justify-center p-2 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl cursor-pointer shrink-0"
              aria-label="Buka menu navigasi"
            >
              <MenuIcon className="w-5 h-5" />
            </button>
          )}

          <div className="min-w-0">
            {/* Tampilan HP (<640px): Judul Pendek 1 baris, nama resto di bawahnya dipotong ellipsis */}
            <div className="sm:hidden">
              <h1 className="text-sm font-bold text-stone-900 dark:text-white leading-tight truncate">
                {shortTitle}
              </h1>
              {restaurantName && (
                <p className="text-[10px] text-stone-500 dark:text-stone-400 truncate max-w-[120px] xs:max-w-[160px] leading-tight">
                  {restaurantName}
                </p>
              )}
            </div>

            {/* Tampilan Layar Lebar (>=640px): Judul Lengkap */}
            <div className="hidden sm:flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
                <span>{displayTitle}</span>
              </h1>
              {displayTitle !== restaurantName && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 truncate max-w-xs">
                  {restaurantName}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Baris Ikon Seragam (Koneksi, Suara, Tema, Avatar) muat dalam 1 baris di 320px */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Firestore Connection Indicator (Ikon seragam di HP, pill di desktop) */}
          <div
            className={`w-[34px] h-[34px] sm:w-auto sm:h-auto flex items-center justify-center sm:px-2.5 sm:py-1 rounded-xl sm:rounded-full text-xs font-semibold shrink-0 ${
              isOnline
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 animate-pulse'
            }`}
            title={
              isOnline
                ? 'Firestore online & tersinkronisasi realtime'
                : 'Koneksi Firestore terputus (Offline)'
            }
          >
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
              }`}
            />
            <span className="hidden sm:inline font-bold ml-1.5">
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          {/* Screen WakeLock Indicator (Desktop only) */}
          {wakeLockActive && (
            <div
              className="hidden md:flex items-center gap-1 px-2 py-1 rounded-md bg-stone-100 dark:bg-stone-800 text-[11px] font-medium text-stone-600 dark:text-stone-300 shrink-0"
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
                muteTemporarily(5);
              }
            }}
            className={`w-[34px] h-[34px] sm:w-[38px] sm:h-[38px] flex items-center justify-center rounded-xl transition-colors cursor-pointer shrink-0 ${
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
              <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />
            ) : (
              <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-[#FF6B1A]" />
            )}
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="w-[34px] h-[34px] sm:w-[38px] sm:h-[38px] flex items-center justify-center text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors cursor-pointer shrink-0"
            title={theme === 'dark' ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
            aria-label="Ganti tema"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-stone-600" />
            )}
          </button>

          {/* Staff Profile & Logout */}
          {profile && (
            <div className="relative shrink-0" ref={userMenuRef}>
              {/* Tampilan HP: Avatar Bulat dengan Huruf Pertama (tidak terpotong) */}
              <div className="sm:hidden">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="w-[34px] h-[34px] rounded-full bg-[#FF6B1A] text-white font-black text-xs flex items-center justify-center cursor-pointer shadow-xs active:scale-95 transition-transform"
                  aria-label="Menu Pengguna"
                  title={`Pengguna: ${profile.name}`}
                >
                  {initialLetter}
                </button>

                {/* Popover Menu saat avatar diketuk */}
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-[#1e1e1e] border border-stone-200 dark:border-stone-800 rounded-2xl shadow-xl p-3 z-50 animate-in fade-in-50 zoom-in-95 duration-150">
                    <div className="pb-2 border-b border-stone-100 dark:border-stone-800">
                      <p className="text-xs font-bold text-stone-900 dark:text-white truncate">
                        {profile.name}
                      </p>
                      <p className="text-[10px] font-semibold text-[#FF6B1A] uppercase tracking-wider mt-0.5">
                        {USER_ROLE_LABELS[profile.role]}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        signOut();
                      }}
                      className="w-full mt-2 flex items-center gap-2 px-2.5 py-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Keluar (Logout)</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Tampilan Desktop: Tetap dipertahankan nama lengkap, peran, dan tombol logout */}
              <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-stone-200 dark:border-stone-800">
                <div className="text-right">
                  <p className="text-xs font-bold text-stone-900 dark:text-stone-100 leading-none">
                    {profile.name}
                  </p>
                  <span className="text-[10px] font-semibold text-[#FF6B1A] uppercase tracking-wider mt-0.5 block">
                    {USER_ROLE_LABELS[profile.role]}
                  </span>
                </div>

                <button
                  onClick={signOut}
                  className="min-h-[38px] min-w-[38px] flex items-center justify-center p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors cursor-pointer"
                  title="Keluar (Logout)"
                  aria-label="Keluar"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
