import { useState, useEffect } from 'react';

/**
 * Shared time ticker updating every second.
 * Provides a single interval to keep all kitchen timers and order timers synchronized
 * without unnecessary re-renders or competing timers.
 */
export function useNow(updateIntervalMs = 1000): number {
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, updateIntervalMs);

    return () => clearInterval(timer);
  }, [updateIntervalMs]);

  return now;
}
