import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, AlertTriangle, Sparkles } from 'lucide-react';
import { useSoundStore } from '../../store/soundStore';
import { audioEngine } from '../../lib/audioEngine';

export const SoundGate: React.FC = () => {
  const {
    isAudioContextActive,
    setAudioContextActive,
    activateAudio,
  } = useSoundStore();

  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Check initial context state
    const running = audioEngine.isContextRunning();
    setAudioContextActive(running);
    if (!running) {
      setShowModal(true);
    }

    // Periodic check in case browser auto-suspended the context
    const interval = setInterval(() => {
      const active = audioEngine.isContextRunning();
      setAudioContextActive(active);
    }, 3000);

    return () => clearInterval(interval);
  }, [setAudioContextActive]);

  const handleActivate = async () => {
    const success = await activateAudio();
    if (success) {
      setShowModal(false);
    }
  };

  // If audio context is running, nothing to block
  if (isAudioContextActive) {
    return null;
  }

  return (
    <>
      {/* Permanent Red Warning Bar on Staff Pages */}
      <div
        onClick={handleActivate}
        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 text-center text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md select-none transition-colors animate-pulse sticky top-0 z-40"
        role="alert"
      >
        <VolumeX className="w-4 h-4 shrink-0" />
        <span>Suara notifikasi mati — Ketuk di sini untuk mengaktifkan alarm</span>
      </div>

      {/* Interactive Sound Gate Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-[#1a1a1a] rounded-3xl p-6 sm:p-8 shadow-2xl border border-stone-200 dark:border-stone-800 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-orange-500/10 text-[#FF6B1A] flex items-center justify-center mx-auto">
              <Volume2 className="w-8 h-8 animate-bounce" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-stone-900 dark:text-white">
                Aktifkan Notifikasi Suara
              </h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 mt-2 leading-relaxed">
                Kebijakan browser mewajibkan satu ketukan interaksi agar alarm pesanan
                baru dapat berbunyi otomatis dan keras di perangkat ini.
              </p>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-2.5 text-xs text-amber-700 dark:text-amber-400 text-left">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                Pastikan volume HP atau speaker komputer Anda tidak dalam keadaan hening.
              </span>
            </div>

            <button
              onClick={handleActivate}
              className="w-full py-4 px-6 bg-[#FF6B1A] hover:bg-[#E5530A] active:scale-[0.98] text-white font-bold rounded-2xl text-base shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Sparkles className="w-5 h-5" />
              <span>Aktifkan & Uji Suara Sekarang</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
