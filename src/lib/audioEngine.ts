/**
 * Pure Web Audio API Sound Synthesizer & Web Speech API Engine.
 * Zero external audio files. Generates rich bell/chime/alarm harmonics via oscillators.
 */

import { AlarmTone } from '../types';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private loopTimeoutId: number | null = null;
  private isAlarmRunning = false;
  private currentVolume = 0.8; // default 80%

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    return this.ctx;
  }

  public isContextRunning(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /**
   * Must be called during or after a user interaction to satisfy browser autoplay policy.
   */
  public async resume(): Promise<boolean> {
    const ctx = this.getContext();
    if (!ctx) return false;
    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      this.primeSpeechSynthesis();
      return ctx.state === 'running';
    } catch {
      return false;
    }
  }

  public setVolume(volume0to100: number) {
    const clamped = Math.max(0, Math.min(100, volume0to100));
    this.currentVolume = clamped / 100;
  }

  public getVolumePercent(): number {
    return Math.round(this.currentVolume * 100);
  }

  /**
   * Synthesizes a bell chime tone with natural harmonics and smooth exponential decay.
   */
  private playBellHarmonic(
    ctx: AudioContext,
    freq: number,
    startTime: number,
    duration: number,
    gainLevel: number
  ) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainLevel), startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);

    // Overtone for bell resonance
    const overtone = ctx.createOscillator();
    const overGain = ctx.createGain();
    overtone.type = 'sine';
    overtone.frequency.setValueAtTime(freq * 2.01, startTime);

    overGain.gain.setValueAtTime(0.0001, startTime);
    overGain.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, gainLevel * 0.35),
      startTime + 0.01
    );
    overGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.7);

    overtone.connect(overGain);
    overGain.connect(ctx.destination);

    overtone.start(startTime);
    overtone.stop(startTime + duration * 0.7 + 0.05);
  }

  /**
   * 1. DEFAULT: Lonceng 2-nada standar (E5 659Hz -> A5 880Hz)
   */
  public playDefaultAlarm(customVolume?: number): number {
    const ctx = this.getContext();
    if (!ctx) return 800;
    const masterVol = customVolume !== undefined ? customVolume / 100 : this.currentVolume;
    if (masterVol <= 0.01) return 800;

    const now = ctx.currentTime;
    this.playBellHarmonic(ctx, 659.25, now, 0.4, masterVol * 0.7);
    this.playBellHarmonic(ctx, 880.0, now + 0.22, 0.6, masterVol * 0.85);

    this.triggerVibrate([150, 80, 250]);
    return 850; // duration ms
  }

  /**
   * 2. SIRENE_CEPAT: Dua nada tinggi rendah bergantian cepat (960Hz / 720Hz)
   */
  public playSireneCepat(customVolume?: number): number {
    const ctx = this.getContext();
    if (!ctx) return 900;
    const masterVol = customVolume !== undefined ? customVolume / 100 : this.currentVolume;
    if (masterVol <= 0.01) return 900;

    const now = ctx.currentTime;
    const freqs = [960, 720, 960, 720, 960, 720];
    freqs.forEach((f, idx) => {
      const t = now + idx * 0.12;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, t);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(masterVol * 0.6, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.12);
    });

    this.triggerVibrate([100, 50, 100, 50, 100]);
    return 800;
  }

  /**
   * 3. BEL_PANIK: Dering logam cepat berulang
   */
  public playBelPanik(customVolume?: number): number {
    const ctx = this.getContext();
    if (!ctx) return 850;
    const masterVol = customVolume !== undefined ? customVolume / 100 : this.currentVolume;
    if (masterVol <= 0.01) return 850;

    const now = ctx.currentTime;
    for (let i = 0; i < 6; i++) {
      const t = now + i * 0.1;
      this.playBellHarmonic(ctx, 1200 + (i % 2) * 200, t, 0.12, masterVol * 0.75);
    }

    this.triggerVibrate([80, 40, 80, 40, 80]);
    return 750;
  }

  /**
   * 4. TELEPON: Dering ganda klasik (440Hz + 480Hz)
   */
  public playTelepon(customVolume?: number): number {
    const ctx = this.getContext();
    if (!ctx) return 950;
    const masterVol = customVolume !== undefined ? customVolume / 100 : this.currentVolume;
    if (masterVol <= 0.01) return 950;

    const now = ctx.currentTime;
    const playBurst = (startTime: number, duration: number) => {
      [440, 480].forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.linearRampToValueAtTime(masterVol * 0.45, startTime + 0.02);
        gain.gain.linearRampToValueAtTime(0.0001, startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      });
    };

    playBurst(now, 0.28);
    playBurst(now + 0.38, 0.28);

    this.triggerVibrate([200, 100, 200]);
    return 800;
  }

  /**
   * 5. TIGA_BIP: Tiga bip persegi tajam dan cepat (880Hz)
   */
  public playTigaBip(customVolume?: number): number {
    const ctx = this.getContext();
    if (!ctx) return 600;
    const masterVol = customVolume !== undefined ? customVolume / 100 : this.currentVolume;
    if (masterVol <= 0.01) return 600;

    const now = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.14;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, t);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(masterVol * 0.55, t + 0.01);
      gain.gain.linearRampToValueAtTime(0.0001, t + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.09);
    }

    this.triggerVibrate([80, 60, 80, 60, 80]);
    return 550;
  }

  /**
   * 6. PESANAN_DATANG: Arpeggio naik ceria dan mendesak (C5 -> E5 -> G5 -> C6)
   */
  public playPesananDatang(customVolume?: number): number {
    const ctx = this.getContext();
    if (!ctx) return 800;
    const masterVol = customVolume !== undefined ? customVolume / 100 : this.currentVolume;
    if (masterVol <= 0.01) return 800;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      this.playBellHarmonic(ctx, freq, now + idx * 0.12, 0.45, masterVol * 0.75);
    });

    this.triggerVibrate([100, 50, 150]);
    return 750;
  }

  /**
   * 7. KLAKSON_PENDEK: Dua denyut klakson tajam (380Hz & 460Hz)
   */
  public playKlaksonPendek(customVolume?: number): number {
    const ctx = this.getContext();
    if (!ctx) return 650;
    const masterVol = customVolume !== undefined ? customVolume / 100 : this.currentVolume;
    if (masterVol <= 0.01) return 650;

    const now = ctx.currentTime;
    const playHorn = (startTime: number) => {
      [380, 460].forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.linearRampToValueAtTime(masterVol * 0.65, startTime + 0.015);
        gain.gain.linearRampToValueAtTime(0.0001, startTime + 0.16);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.18);
      });
    };

    playHorn(now);
    playHorn(now + 0.22);

    this.triggerVibrate([120, 60, 120]);
    return 600;
  }

  /**
   * Main tone dispatcher
   */
  public playToneOnce(tone: AlarmTone = 'DEFAULT', customVolume?: number): number {
    const ctx = this.getContext();
    if (ctx && ctx.state !== 'running') {
      ctx.resume().catch(() => {});
    }

    switch (tone) {
      case 'SIRENE_CEPAT':
        return this.playSireneCepat(customVolume);
      case 'BEL_PANIK':
        return this.playBelPanik(customVolume);
      case 'TELEPON':
        return this.playTelepon(customVolume);
      case 'TIGA_BIP':
        return this.playTigaBip(customVolume);
      case 'PESANAN_DATANG':
        return this.playPesananDatang(customVolume);
      case 'KLAKSON_PENDEK':
        return this.playKlaksonPendek(customVolume);
      case 'DEFAULT':
      default:
        return this.playDefaultAlarm(customVolume);
    }
  }

  // Alias for backward compatibility
  public playTwoToneAlarmOnce(customVolume?: number) {
    this.playDefaultAlarm(customVolume);
  }

  private triggerVibrate(pattern: number[]) {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // ignore
      }
    }
  }

  // ==========================================
  // Web Speech API (speechSynthesis)
  // ==========================================

  public isSpeechSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  public getIndonesianVoice(): SpeechSynthesisVoice | null {
    if (!this.isSpeechSupported()) return null;
    const voices = window.speechSynthesis.getVoices();
    return (
      voices.find((v) => v.lang === 'id-ID' || v.lang === 'id_ID' || v.lang.startsWith('id')) ||
      null
    );
  }

  public hasIndonesianVoice(): boolean {
    return !!this.getIndonesianVoice();
  }

  public primeSpeechSynthesis() {
    if (!this.isSpeechSupported()) return;
    try {
      const u = new SpeechSynthesisUtterance('');
      u.volume = 0;
      window.speechSynthesis.speak(u);
    } catch {
      // ignore
    }
  }

  public speakText(text: string, customVolume?: number): Promise<void> {
    return new Promise((resolve) => {
      if (!this.isSpeechSupported()) {
        resolve();
        return;
      }

      try {
        window.speechSynthesis.cancel(); // cancel any active queue
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'id-ID';

        const idVoice = this.getIndonesianVoice();
        if (idVoice) {
          utterance.voice = idVoice;
        }

        const vol = customVolume !== undefined ? customVolume / 100 : this.currentVolume;
        utterance.volume = Math.max(0.1, Math.min(1.0, vol));
        utterance.rate = 1.05;
        utterance.pitch = 1.0;

        let finished = false;
        const complete = () => {
          if (!finished) {
            finished = true;
            resolve();
          }
        };

        utterance.onend = complete;
        utterance.onerror = complete;

        // Safety fallback timeout in case browser gets stuck
        setTimeout(complete, 10000);

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('Speech synthesis error:', err);
        resolve();
      }
    });
  }

  // ==========================================
  // Looping Repeating Alarm Controller
  // ==========================================

  public startRepeatingAlarm(options: {
    tone: AlarmTone;
    mode: 'NADA' | 'SUARA' | 'NADA_LALU_SUARA';
    voiceText: string;
    volume?: number;
  }) {
    if (this.isAlarmRunning) return;
    this.isAlarmRunning = true;

    const runLoopCycle = async () => {
      if (!this.isAlarmRunning) return;

      const vol = options.volume !== undefined ? options.volume : this.currentVolume * 100;
      const speechAvail = this.isSpeechSupported();

      // Fallback mode if speech not supported or no voices
      let activeMode = options.mode;
      if ((activeMode === 'SUARA' || activeMode === 'NADA_LALU_SUARA') && !speechAvail) {
        activeMode = 'NADA';
      }

      if (activeMode === 'NADA') {
        const toneDuration = this.playToneOnce(options.tone, vol);
        // Jeda antar pengulangan maksimal 1,5 detik
        this.loopTimeoutId = window.setTimeout(() => {
          if (this.isAlarmRunning) runLoopCycle();
        }, toneDuration + 1400);
      } else if (activeMode === 'SUARA') {
        await this.speakText(options.voiceText, vol);
        if (this.isAlarmRunning) {
          this.loopTimeoutId = window.setTimeout(() => {
            if (this.isAlarmRunning) runLoopCycle();
          }, 1400);
        }
      } else if (activeMode === 'NADA_LALU_SUARA') {
        const toneDuration = this.playToneOnce(options.tone, vol);
        await new Promise((r) => setTimeout(r, toneDuration + 200));
        if (this.isAlarmRunning) {
          await this.speakText(options.voiceText, vol);
        }
        if (this.isAlarmRunning) {
          this.loopTimeoutId = window.setTimeout(() => {
            if (this.isAlarmRunning) runLoopCycle();
          }, 1400);
        }
      }
    };

    runLoopCycle();
  }

  // Backward compatibility alias
  public startRepeatingNewOrderAlarm() {
    this.startRepeatingAlarm({
      tone: 'DEFAULT',
      mode: 'NADA',
      voiceText: '',
    });
  }

  public stopRepeatingNewOrderAlarm() {
    this.stopRepeatingAlarm();
  }

  public stopRepeatingAlarm() {
    this.isAlarmRunning = false;
    if (this.loopTimeoutId !== null) {
      clearTimeout(this.loopTimeoutId);
      this.loopTimeoutId = null;
    }
    if (this.isSpeechSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  }

  public playSuccessTone() {
    const ctx = this.getContext();
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    this.playBellHarmonic(ctx, 523.25, now, 0.2, this.currentVolume * 0.4);
    this.playBellHarmonic(ctx, 659.25, now + 0.1, 0.2, this.currentVolume * 0.4);
    this.playBellHarmonic(ctx, 783.99, now + 0.2, 0.35, this.currentVolume * 0.5);
  }

  /**
   * Chime merdu saat pembayaran pesanan dikonfirmasi LUNAS di layar pelanggan
   */
  public playPaymentSuccessChime(customVolume?: number): void {
    const ctx = this.getContext();
    if (!ctx) return;
    if (ctx.state !== 'running') {
      ctx.resume().catch(() => {});
    }
    const vol = customVolume !== undefined ? customVolume / 100 : this.currentVolume;
    if (vol <= 0.01) return;
    const now = ctx.currentTime;
    // Ascending bright chime: C5 -> E5 -> G5 -> C6
    this.playBellHarmonic(ctx, 523.25, now, 0.25, vol * 0.6);
    this.playBellHarmonic(ctx, 659.25, now + 0.1, 0.25, vol * 0.65);
    this.playBellHarmonic(ctx, 783.99, now + 0.2, 0.35, vol * 0.7);
    this.playBellHarmonic(ctx, 1046.5, now + 0.32, 0.45, vol * 0.8);
    this.triggerVibrate([100, 50, 150]);
  }

  /**
   * Nada pendek khusus saat pelanggan menekan "Saya Sudah Bayar" di dashboard admin.
   * Berbeda dari alarm pesanan baru, tidak berulang.
   */
  public playPaymentClaimTone(customVolume?: number): number {
    const ctx = this.getContext();
    if (!ctx) return 450;
    if (ctx.state !== 'running') {
      ctx.resume().catch(() => {});
    }
    const vol = customVolume !== undefined ? customVolume / 100 : this.currentVolume;
    if (vol <= 0.01) return 450;
    const now = ctx.currentTime;
    // Bright 2-tone cash register chime (587.33Hz D5 -> 880Hz A5)
    this.playBellHarmonic(ctx, 587.33, now, 0.2, vol * 0.75);
    this.playBellHarmonic(ctx, 880.0, now + 0.14, 0.35, vol * 0.9);
    this.triggerVibrate([80, 40, 100]);
    return 450;
  }

  /**
   * Mainkan nada klaim bayar + suara orang (Web Speech API) SEKALI
   */
  public async playPaymentClaimNotification(options: {
    voiceText: string;
    volume?: number;
  }): Promise<void> {
    const vol = options.volume !== undefined ? options.volume : this.currentVolume * 100;
    const toneDuration = this.playPaymentClaimTone(vol);
    await new Promise((resolve) => setTimeout(resolve, toneDuration + 120));
    if (options.voiceText) {
      await this.speakText(options.voiceText, vol);
    }
  }
}

export const audioEngine = new AudioEngine();
