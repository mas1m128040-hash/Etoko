import { useState, useEffect, useRef } from 'react';
import { Order, Settings } from '../types';
import { orderService } from '../services/orderService';
import { settingsService } from '../services/settingsService';
import { audioEngine } from '../lib/audioEngine';
import { useSoundStore } from '../store/soundStore';
import { useAuth } from './useAuth';
import { DEFAULT_SETTINGS } from '../config/constants';
import { formatVoiceOrderText } from '../lib/formatters';

// ============================================================================
// SINGLETON STORE & AUDIO CONTROLLER
// Mencegah multiple Firestore subscription dan multiple audio loops
// ============================================================================
let sharedNewOrders: Order[] = [];
let sharedLoading = true;
let sharedSettings: Settings = DEFAULT_SETTINGS;
let activeSubscribers = 0;
let unsubscribeFirestore: (() => void) | null = null;
let unsubscribeSettings: (() => void) | null = null;
const stateListeners = new Set<() => void>();

let originalDocumentTitle =
  typeof document !== 'undefined' ? document.title : 'SMART RESTAURANT ORDER SYSTEM';
let titleFlashTimer: number | null = null;

function notifySubscribers() {
  stateListeners.forEach((fn) => fn());
}

const ORDINALS = ['Pertama', 'Kedua', 'Ketiga', 'Keempat', 'Kelima'];

function spokenNumber(code: string): string | number {
  const n = parseInt(code, 10);
  return Number.isNaN(n) ? code : n;
}

function buildAlarmVoiceText(orders: Order[], template: string): string {
  if (orders.length === 0) return template;
  if (orders.length === 1) {
    const o = orders[0];
    return formatVoiceOrderText(template, {
      orderCode: o.orderCode,
      tableNumber: o.tableNumber,
      customerName: o.customerName,
      payableAmount: o.payableAmount,
      totalPrice: o.totalPrice,
      items: o.items,
    });
  }
  const shown = orders.slice(0, 5);
  const parts = shown.map(
    (o, i) => `${ORDINALS[i]}, nomor ${spokenNumber(o.orderCode)}, meja ${o.tableNumber}, atas nama ${o.customerName}`
  );
  const rest = orders.length - shown.length;
  return `Perhatian! Ada ${orders.length} pesanan baru masuk. ${parts.join('. ')}.${rest > 0 ? ` Dan ${rest} pesanan lainnya.` : ''} Segera cek dan terima.`;
}

function syncAudioAndTitle(
  orders: Order[],
  settings: Settings,
  soundEnabled: boolean,
  isMuted: boolean,
  isAudioContextActive: boolean,
  volume: number
) {
  const hasNewOrders = orders.length > 0;

  // 1. Audio loop synchronization
  // Hanya berbunyi berulang jika ADA pesanan berstatus BARU
  if (hasNewOrders && soundEnabled && !isMuted && isAudioContextActive) {
    audioEngine.setVolume(volume);
    if (typeof settings.voiceRate === 'number') {
      audioEngine.setVoiceRate(settings.voiceRate);
    }

    const template =
      settings.alarmVoiceText ||
      'Pesanan baru dari meja {meja}, atas nama {nama}. Segera terima.';

    const formattedVoiceText = buildAlarmVoiceText(orders, template);

    audioEngine.startRepeatingAlarm({
      tone: settings.alarmTone || 'DEFAULT',
      mode: settings.alarmMode || 'NADA',
      voiceText: formattedVoiceText,
      volume,
      orderKey: orders.map((o) => o.id).join(','),
    });
  } else {
    audioEngine.stopRepeatingAlarm();
  }

  // 2. Tab title flashing
  if (typeof document !== 'undefined') {
    if (hasNewOrders) {
      if (!titleFlashTimer) {
        let toggle = false;
        titleFlashTimer = window.setInterval(() => {
          toggle = !toggle;
          const count = sharedNewOrders.length;
          document.title = toggle
            ? `(${count}) PESANAN BARU MASUK!`
            : `🔔 RESTO NOTIFIKASI (${count})`;
        }, 1000);
      }
    } else {
      if (titleFlashTimer) {
        clearInterval(titleFlashTimer);
        titleFlashTimer = null;
      }
      document.title = originalDocumentTitle;
    }
  }
}

export function useNewOrderAlarm() {
  const [, setRerender] = useState(0);

  const {
    soundEnabled,
    volume,
    isCurrentlyMuted,
    isAudioContextActive,
    setAudioContextActive,
  } = useSoundStore();

  const { profile } = useAuth();
  const isMuted = isCurrentlyMuted();

  // Lifecycle singleton subscription
  useEffect(() => {
    activeSubscribers++;

    const listener = () => setRerender((v) => v + 1);
    stateListeners.add(listener);

    // Buka listener Firestore jika pelanggan pertama terpasang
    if (activeSubscribers === 1) {
      unsubscribeSettings = settingsService.subscribeSettings((s) => {
        sharedSettings = s;
        notifySubscribers();
      });

      unsubscribeFirestore = orderService.subscribeNewOrders((orders) => {
        // ATURAN UTAMA: Hanya pesanan dengan status 'BARU' yang masuk antrean newOrders
        // Perubahan dokumen non-BARU sama sekali tidak memengaruhi list ini
        const onlyBaruOrders = orders.filter((o) => o.status === 'BARU');
        sharedNewOrders = onlyBaruOrders;
        sharedLoading = false;
        notifySubscribers();
      });
    }

    return () => {
      stateListeners.delete(listener);
      activeSubscribers--;

      // Tutup listener jika tidak ada lagi komponen yang membutuhkan
      if (activeSubscribers === 0) {
        if (unsubscribeFirestore) {
          unsubscribeFirestore();
          unsubscribeFirestore = null;
        }
        if (unsubscribeSettings) {
          unsubscribeSettings();
          unsubscribeSettings = null;
        }
        audioEngine.stopRepeatingAlarm();
        if (titleFlashTimer) {
          clearInterval(titleFlashTimer);
          titleFlashTimer = null;
        }
        if (typeof document !== 'undefined') {
          document.title = originalDocumentTitle;
        }
      }
    };
  }, []);

  // Update running AudioContext state
  useEffect(() => {
    const isCtxRunning = audioEngine.isContextRunning();
    setAudioContextActive(isCtxRunning);
  }, [setAudioContextActive]);

  // Synchronize audio state whenever newOrders, settings, volume, or mute state changes
  useEffect(() => {
    syncAudioAndTitle(
      sharedNewOrders,
      sharedSettings,
      soundEnabled,
      isMuted,
      isAudioContextActive,
      volume
    );
  }, [sharedNewOrders, sharedSettings, soundEnabled, isMuted, isAudioContextActive, volume]);

  const acceptSingleOrder = async (orderId: string) => {
    if (!profile) return;
    await orderService.updateStatusInTransaction(
      orderId,
      'BARU',
      'DITERIMA',
      {
        uid: profile.id,
        name: profile.name,
      }
    );
  };

  const acceptAllNewOrders = async () => {
    if (!profile) return;
    await orderService.acceptAllNewOrders(sharedNewOrders, {
      uid: profile.id,
      name: profile.name,
    });
  };

  return {
    newOrders: sharedNewOrders,
    hasNewOrders: sharedNewOrders.length > 0,
    newOrdersCount: sharedNewOrders.length,
    isAlarmSounding: sharedNewOrders.length > 0 && soundEnabled && !isMuted,
    loading: sharedLoading,
    acceptSingleOrder,
    acceptAllNewOrders,
  };
}
