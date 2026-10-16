import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useCartStore } from '../store/cartStore';

// Build ID yang disisipkan saat kompilasi aplikasi via vite.config.ts define
export const currentAppBuildId: string =
  typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : 'dev-build';

const RELOAD_TARGET_KEY = 'app_version_reload_target';
const LAST_RELOAD_TIME_KEY = 'app_version_last_reload_time';
const MIN_RELOAD_INTERVAL_MS = 60 * 1000; // Minimal jeda 60 detik antar muat ulang otomatis

/**
 * Cek apakah fitur deteksi versi harus dinonaktifkan:
 * - Mode pengembangan (import.meta.env.DEV)
 * - Preview AI Studio (hostname mengandung "aistudio", "ai.studio", "usercontent.goog", atau "run.app")
 * - Host lokal (localhost / 127.0.0.1)
 */
export const isVersionCheckDisabled = (): boolean => {
  if (typeof window === 'undefined') return true;

  // 1. Nonaktif di mode pengembangan Vite
  if (import.meta.env.DEV) return true;

  // 2. Nonaktif di lingkungan preview AI Studio & Google sandbox
  const hostname = (window.location.hostname || '').toLowerCase();
  if (
    hostname.includes('aistudio') ||
    hostname.includes('ai.studio') ||
    hostname.includes('usercontent.goog') ||
    hostname.includes('run.app') ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1'
  ) {
    return true;
  }

  return false;
};

export function useVersionCheck() {
  const [newVersionAvailable, setNewVersionAvailable] = useState<boolean>(false);
  const [latestServerVersion, setLatestServerVersion] = useState<string | null>(null);
  const location = useLocation();
  const checkingRef = useRef<boolean>(false);
  const hasLoggedVersionRef = useRef<string | null>(null);

  const checkVersion = useCallback(async () => {
    // Nonaktif di development & preview AI Studio
    if (isVersionCheckDisabled()) return;

    if (checkingRef.current) return;
    checkingRef.current = true;

    try {
      // Muat version.json dengan fetch cache "no-store" dan parameter acak, tanpa cache
      const cacheBuster = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const url = `/version.json?_t=${cacheBuster}`;
      const res = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      });

      // Abaikan diam-diam jika status bukan 200 OK
      if (!res.ok) {
        checkingRef.current = false;
        return;
      }

      // Validasi respon JSON: jika gagal di-parse, abaikan diam-diam tanpa reload
      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        checkingRef.current = false;
        return;
      }

      const serverBuildId = data?.buildId ? String(data.buildId).trim() : null;
      if (!serverBuildId) {
        checkingRef.current = false;
        return;
      }

      if (serverBuildId !== currentAppBuildId) {
        // Cukup satu log ringkas saat versi berbeda pertama kali terdeteksi
        if (hasLoggedVersionRef.current !== serverBuildId) {
          hasLoggedVersionRef.current = serverBuildId;
          console.log(`[VersionCheck] Versi baru tersedia di server: ${serverBuildId}`);
        }
        setNewVersionAvailable(true);
        setLatestServerVersion(serverBuildId);
      } else {
        setNewVersionAvailable(false);
        setLatestServerVersion(null);
        try {
          sessionStorage.removeItem(RELOAD_TARGET_KEY);
        } catch {}
      }
    } catch {
      // Abaikan error fetch diam-diam tanpa reload
    } finally {
      checkingRef.current = false;
    }
  }, []);

  // 1. Cek versi saat aplikasi dibuka (hanya jika aktif)
  useEffect(() => {
    if (isVersionCheckDisabled()) return;
    checkVersion();
  }, [checkVersion]);

  // 2. Cek versi setiap 5 menit (hanya jika aktif)
  useEffect(() => {
    if (isVersionCheckDisabled()) return;
    const FIVE_MINUTES = 5 * 60 * 1000;
    const interval = setInterval(() => {
      checkVersion();
    }, FIVE_MINUTES);

    return () => clearInterval(interval);
  }, [checkVersion]);

  // 3. Cek versi setiap halaman kembali terlihat (visibilitychange) (hanya jika aktif)
  useEffect(() => {
    if (isVersionCheckDisabled()) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkVersion]);

  // 4. Tindakan jika versi server berbeda dari versi client
  useEffect(() => {
    if (!newVersionAvailable || !latestServerVersion) return;
    if (isVersionCheckDisabled()) return;

    const pathname = location.pathname;
    const isAdmin = pathname.startsWith('/admin');

    // Untuk admin, JANGAN muat ulang otomatis; tampilkan banner yang sama dan hanya muat ulang atas ketukan admin.
    if (isAdmin) {
      return;
    }

    // Untuk customer, muat ulang otomatis hanya bila sedang di halaman menu dengan keranjang kosong dan tidak ada proses checkout
    const isMenuPage =
      pathname === '/menu' ||
      pathname === '/' ||
      pathname === '';

    const cartItems = useCartStore.getState().items;
    const isCartEmpty = !cartItems || cartItems.length === 0;
    const isCheckout = pathname.includes('/checkout');

    if (!isMenuPage || !isCartEmpty || isCheckout) {
      // Tampilkan banner saja
      return;
    }

    // --- PENJAGA ANTI-LOOP ---
    // (1) Muat ulang otomatis untuk satu versi server hanya boleh terjadi SEKALI
    let previousReloadTarget: string | null = null;
    let lastReloadTime = 0;
    try {
      previousReloadTarget = sessionStorage.getItem(RELOAD_TARGET_KEY);
      const lastTimeStr = sessionStorage.getItem(LAST_RELOAD_TIME_KEY);
      lastReloadTime = lastTimeStr ? parseInt(lastTimeStr, 10) : 0;
    } catch {}

    // Jika versi server sama dengan target yang sudah pernah dicoba reload, JANGAN memuat ulang lagi. Tampilkan banner sebagai gantinya.
    if (previousReloadTarget === latestServerVersion) {
      return;
    }

    // (2) Beri jeda minimal 60 detik antar muat ulang otomatis
    const now = Date.now();
    if (now - lastReloadTime < MIN_RELOAD_INTERVAL_MS) {
      return;
    }

    // Catat target reload dan waktu reload di sessionStorage sebelum memuat ulang
    try {
      sessionStorage.setItem(RELOAD_TARGET_KEY, latestServerVersion);
      sessionStorage.setItem(LAST_RELOAD_TIME_KEY, String(now));
    } catch {}

    window.location.reload();
  }, [newVersionAvailable, latestServerVersion, location.pathname]);

  const reloadApp = useCallback(() => {
    if (latestServerVersion) {
      try {
        sessionStorage.setItem(RELOAD_TARGET_KEY, latestServerVersion);
        sessionStorage.setItem(LAST_RELOAD_TIME_KEY, String(Date.now()));
      } catch {}
    }
    window.location.reload();
  }, [latestServerVersion]);

  return {
    newVersionAvailable,
    reloadApp,
    currentAppBuildId,
    latestServerVersion,
    checkVersion,
  };
}
