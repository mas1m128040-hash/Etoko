import { useState, useEffect, useRef } from 'react';
import { Order, Settings } from '../types';
import { orderService } from '../services/orderService';
import { settingsService } from '../services/settingsService';
import { audioEngine } from '../lib/audioEngine';
import { useSoundStore } from '../store/soundStore';
import { useAuth } from './useAuth';
import { DEFAULT_SETTINGS } from '../config/constants';
import { formatRupiah, formatVoiceOrderText } from '../lib/formatters';

export function useNewOrderAlarm() {
  const [newOrders, setNewOrders] = useState<Order[]>([]);
  const [isAlarmSounding, setIsAlarmSounding] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  const {
    soundEnabled,
    volume,
    isCurrentlyMuted,
    isAudioContextActive,
    setAudioContextActive,
  } = useSoundStore();

  const { profile } = useAuth();
  const prevCountRef = useRef<number>(0);
  const originalTitleRef = useRef<string>(
    typeof document !== 'undefined' ? document.title : 'SMART RESTAURANT ORDER SYSTEM'
  );
  const titleFlashIntervalRef = useRef<number | null>(null);

  // 1. Subscribe to settings for alarmTone, alarmMode, alarmVoiceText
  useEffect(() => {
    const unsubscribeSettings = settingsService.subscribeSettings((s) => {
      setSettings(s);
    });
    return () => unsubscribeSettings();
  }, []);

  // 2. Subscribe to BARU orders realtime
  useEffect(() => {
    const unsubscribe = orderService.subscribeNewOrders((orders) => {
      setNewOrders(orders);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 3. Sound state synchronization: derived from data!
  // Alarm tetap berbunyi berulang selama ada pesanan berstatus BARU dan berhenti hanya setelah "Terima Pesanan" ditekan
  useEffect(() => {
    const hasNewOrders = newOrders.length > 0;
    const isMuted = isCurrentlyMuted();

    // Check AudioContext state
    const isCtxRunning = audioEngine.isContextRunning();
    setAudioContextActive(isCtxRunning);

    if (hasNewOrders && soundEnabled && !isMuted && isCtxRunning) {
      setIsAlarmSounding(true);
      audioEngine.setVolume(volume);

      // Oldest order for voice text placeholder replacement
      const oldest = newOrders[0];
      const template =
        settings.alarmVoiceText ||
        'Pesanan baru! Pesanan baru dari meja {meja}. Segera cek dan terima.';

      const formattedVoiceText = oldest
        ? formatVoiceOrderText(template, {
            orderCode: oldest.orderCode,
            tableNumber: oldest.tableNumber,
            customerName: oldest.customerName,
            payableAmount: oldest.payableAmount,
            totalPrice: oldest.totalPrice,
            items: oldest.items,
          })
        : template;

      audioEngine.startRepeatingAlarm({
        tone: settings.alarmTone || 'DEFAULT',
        mode: settings.alarmMode || 'NADA',
        voiceText: formattedVoiceText,
        volume,
      });
    } else {
      setIsAlarmSounding(false);
      audioEngine.stopRepeatingAlarm();
    }

    // 4. Tab title flashing
    if (hasNewOrders) {
      if (!titleFlashIntervalRef.current) {
        let toggle = false;
        titleFlashIntervalRef.current = window.setInterval(() => {
          toggle = !toggle;
          document.title = toggle
            ? `(${newOrders.length}) PESANAN BARU MASUK!`
            : `🔔 RESTO NOTIFIKASI (${newOrders.length})`;
        }, 1000);
      }
    } else {
      if (titleFlashIntervalRef.current) {
        clearInterval(titleFlashIntervalRef.current);
        titleFlashIntervalRef.current = null;
      }
      document.title = originalTitleRef.current;
    }

    prevCountRef.current = newOrders.length;

    return () => {
      audioEngine.stopRepeatingAlarm();
      if (titleFlashIntervalRef.current) {
        clearInterval(titleFlashIntervalRef.current);
        titleFlashIntervalRef.current = null;
      }
    };
  }, [
    newOrders,
    soundEnabled,
    volume,
    settings,
    isCurrentlyMuted,
    isAudioContextActive,
    setAudioContextActive,
  ]);

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
    await orderService.acceptAllNewOrders(newOrders, {
      uid: profile.id,
      name: profile.name,
    });
  };

  return {
    newOrders,
    hasNewOrders: newOrders.length > 0,
    newOrdersCount: newOrders.length,
    isAlarmSounding,
    loading,
    acceptSingleOrder,
    acceptAllNewOrders,
  };
}
