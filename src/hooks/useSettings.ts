import { useState, useEffect } from 'react';
import { Settings } from '../types';
import { settingsService } from '../services/settingsService';
import { DEFAULT_SETTINGS } from '../config/constants';

let cachedSettings: Settings = DEFAULT_SETTINGS;
const listeners = new Set<(s: Settings) => void>();
let isSubscribed = false;

function setupSubscription() {
  if (isSubscribed) return;
  isSubscribed = true;
  settingsService.subscribeSettings(
    (newSettings) => {
      cachedSettings = newSettings;
      listeners.forEach((l) => l(newSettings));
    },
    (err) => {
      console.warn('[useSettings] Gagal memuat pengaturan:', err);
    }
  );
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(cachedSettings);

  useEffect(() => {
    setupSubscription();
    const listener = (s: Settings) => setSettings(s);
    listeners.add(listener);
    // ensure current state is up to date
    setSettings(cachedSettings);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const restaurantName = settings.name?.trim() || DEFAULT_SETTINGS.name || 'SMART RESTO';

  return {
    settings,
    restaurantName,
  };
}
