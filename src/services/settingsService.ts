import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Settings } from '../types';
import { DEFAULT_SETTINGS } from '../config/constants';
import { isForbiddenUrl, FORBIDDEN_URL_ERROR_MESSAGE } from '../lib/urlUtils';

const SETTINGS_DOC = 'restaurant';
const SETTINGS_COL = 'settings';

export const settingsService = {
  async getSettings(): Promise<Settings> {
    const ref = doc(db, SETTINGS_COL, SETTINGS_DOC);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      return DEFAULT_SETTINGS;
    }
    return { ...DEFAULT_SETTINGS, ...snap.data() } as Settings;
  },

  subscribeSettings(
    callback: (settings: Settings) => void,
    onError?: (error: Error) => void
  ) {
    const ref = doc(db, SETTINGS_COL, SETTINGS_DOC);
    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          callback(DEFAULT_SETTINGS);
        } else {
          callback({ ...DEFAULT_SETTINGS, ...snap.data() } as Settings);
        }
      },
      (error) => {
        console.error('[Firestore Error] Gagal memuat dokumen settings/restaurant:', error);
        if (onError) onError(error as Error);
        callback(DEFAULT_SETTINGS);
      }
    );
  },

  async updateSettings(settings: Partial<Settings>): Promise<void> {
    if (settings.appUrl && isForbiddenUrl(settings.appUrl)) {
      throw new Error(FORBIDDEN_URL_ERROR_MESSAGE);
    }
    const ref = doc(db, SETTINGS_COL, SETTINGS_DOC);
    await setDoc(ref, settings, { merge: true });
  },
};
