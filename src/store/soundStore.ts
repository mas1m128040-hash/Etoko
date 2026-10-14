import { create } from 'zustand';
import { STORAGE_KEYS } from '../config/constants';
import { audioEngine } from '../lib/audioEngine';

interface SoundState {
  soundEnabled: boolean;
  volume: number; // 0..100
  mutedUntil: number | null; // epoch timestamp
  isAudioContextActive: boolean;

  setSoundEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
  muteTemporarily: (durationMinutes?: number) => void;
  unmuteNow: () => void;
  setAudioContextActive: (active: boolean) => void;
  activateAudio: () => Promise<boolean>;
  isCurrentlyMuted: () => boolean;
}

function loadInitialSound() {
  let soundEnabled = true;
  let volume = 80;
  let mutedUntil: number | null = null;

  try {
    const rawEnabled = localStorage.getItem(STORAGE_KEYS.SOUND_ENABLED);
    if (rawEnabled !== null) {
      soundEnabled = rawEnabled === 'true';
    }

    const rawVolume = localStorage.getItem(STORAGE_KEYS.SOUND_VOLUME);
    if (rawVolume !== null) {
      volume = parseInt(rawVolume, 10);
      if (isNaN(volume)) volume = 80;
    }

    const rawMuted = localStorage.getItem(STORAGE_KEYS.SOUND_MUTED_UNTIL);
    if (rawMuted) {
      const ts = parseInt(rawMuted, 10);
      if (ts > Date.now()) {
        mutedUntil = ts;
      }
    }
  } catch {
    // fallback
  }

  audioEngine.setVolume(volume);
  return { soundEnabled, volume, mutedUntil };
}

const initial = loadInitialSound();

export const useSoundStore = create<SoundState>((set, get) => ({
  soundEnabled: initial.soundEnabled,
  volume: initial.volume,
  mutedUntil: initial.mutedUntil,
  isAudioContextActive: false,

  setSoundEnabled: (enabled) => {
    localStorage.setItem(STORAGE_KEYS.SOUND_ENABLED, String(enabled));
    set({ soundEnabled: enabled });
  },

  setVolume: (vol) => {
    const clamped = Math.max(0, Math.min(100, vol));
    localStorage.setItem(STORAGE_KEYS.SOUND_VOLUME, String(clamped));
    audioEngine.setVolume(clamped);
    set({ volume: clamped });
  },

  muteTemporarily: (durationMinutes = 5) => {
    const until = Date.now() + durationMinutes * 60 * 1000;
    localStorage.setItem(STORAGE_KEYS.SOUND_MUTED_UNTIL, String(until));
    set({ mutedUntil: until });
  },

  unmuteNow: () => {
    localStorage.removeItem(STORAGE_KEYS.SOUND_MUTED_UNTIL);
    set({ mutedUntil: null });
  },

  setAudioContextActive: (active) => set({ isAudioContextActive: active }),

  activateAudio: async () => {
    const success = await audioEngine.resume();
    if (success) {
      audioEngine.setVolume(get().volume);
      set({ isAudioContextActive: true, soundEnabled: true });
      localStorage.setItem(STORAGE_KEYS.SOUND_ENABLED, 'true');
      audioEngine.playTwoToneAlarmOnce();
    }
    return success;
  },

  isCurrentlyMuted: () => {
    const mutedUntil = get().mutedUntil;
    if (!mutedUntil) return false;
    if (Date.now() > mutedUntil) {
      // Expired, clear
      get().unmuteNow();
      return false;
    }
    return true;
  },
}));
