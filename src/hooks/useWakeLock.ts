import { useState, useEffect, useCallback } from 'react';

export function useWakeLock(enabled: boolean = true) {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const requestWakeLock = useCallback(async () => {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);
    if (!enabled) return;

    try {
      const sentinel = await (navigator as any).wakeLock.request('screen');
      setIsActive(true);
      setError(null);

      sentinel.addEventListener('release', () => {
        setIsActive(false);
      });
    } catch (err: any) {
      setIsActive(false);
      setError(err?.message || 'Gagal mengunci layar tetap aktif');
    }
  }, [enabled]);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      setIsSupported(true);
      requestWakeLock();
    } else {
      setIsSupported(false);
    }

    // Re-acquire wake lock if page becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, requestWakeLock]);

  return { isSupported, isActive, error, requestWakeLock };
}
