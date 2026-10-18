import { useEffect } from 'react';
import { useSoundStore } from '../store/soundStore';
import { audioEngine } from '../lib/audioEngine';

/**
 * Hook untuk membuka kunci AudioContext & Web Speech API secara otomatis pada interaksi pertama pengguna
 * tanpa mewajibkan klik tombol khusus.
 */
export function useAudioUnlock() {
  const { isAudioContextActive, setAudioContextActive, activateAudio } = useSoundStore();

  useEffect(() => {
    // Cek apakah AudioContext sudah berjalan
    if (audioEngine.isContextRunning()) {
      setAudioContextActive(true);
      return;
    }

    let unlocked = false;

    const handleUserInteraction = async () => {
      if (unlocked) return;
      unlocked = true;
      try {
        await activateAudio();
      } catch (err) {
        console.warn('[useAudioUnlock] Gagal mengaktifkan audio:', err);
      } finally {
        removeListeners();
      }
    };

    const events = ['pointerdown', 'touchstart', 'keydown', 'click'];

    const addListeners = () => {
      events.forEach((evt) => {
        document.addEventListener(evt, handleUserInteraction, { capture: true, once: true });
      });
    };

    const removeListeners = () => {
      events.forEach((evt) => {
        document.removeEventListener(evt, handleUserInteraction, { capture: true });
      });
    };

    addListeners();

    // Pantau secara berkala jika browser men-suspend AudioContext di latar belakang
    const interval = setInterval(() => {
      const running = audioEngine.isContextRunning();
      setAudioContextActive(running);
      if (!running && !unlocked) {
        addListeners();
      }
    }, 4000);

    return () => {
      removeListeners();
      clearInterval(interval);
    };
  }, [isAudioContextActive, setAudioContextActive, activateAudio]);
}
