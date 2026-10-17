import { useEffect, useRef } from 'react';
import { orderService } from '../services/orderService';
import { useSettings } from './useSettings';
import { useSoundStore } from '../store/soundStore';
import { useUiStore } from '../store/uiStore';
import { audioEngine } from '../lib/audioEngine';
import { getDateKeyJakarta, formatRupiah, formatVoiceOrderText } from '../lib/formatters';
import { DEFAULT_SETTINGS } from '../config/constants';

const SESSION_STORAGE_CLAIMED_KEY = 'smart_resto_notified_claims';

function getSessionNotifiedClaims(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_CLAIMED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveSessionNotifiedClaims(set: Set<string>) {
  try {
    sessionStorage.setItem(
      SESSION_STORAGE_CLAIMED_KEY,
      JSON.stringify(Array.from(set))
    );
  } catch {}
}

export function usePaymentClaimNotification() {
  const { settings } = useSettings();
  const { soundEnabled, volume, isCurrentlyMuted } = useSoundStore();
  const { addToast } = useUiStore();

  const isInitialLoadRef = useRef<boolean>(true);
  const isPlayingAudioRef = useRef<boolean>(false);
  const dateKey = getDateKeyJakarta(new Date());

  // Simpan nilai terbaru dalam ref agar tidak menyebabkan re-subscribe listener
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  const isCurrentlyMutedRef = useRef(isCurrentlyMuted);
  isCurrentlyMutedRef.current = isCurrentlyMuted;

  const addToastRef = useRef(addToast);
  addToastRef.current = addToast;

  useEffect(() => {
    isInitialLoadRef.current = true;
    const notifiedClaims = getSessionNotifiedClaims();

    const unsubscribe = orderService.subscribeTodayOrders(
      dateKey,
      async (orders) => {
        // 1. Pada pemuatan pertama / re-mount / listener tersambung kembali:
        // Catat semua pesanan yang sudah berstatus claimed agar TIDAK diputar ulang saat halaman dimuat ulang
        if (isInitialLoadRef.current) {
          orders.forEach((o) => {
            if (o.customerClaimedPaid) {
              notifiedClaims.add(o.id);
            }
          });
          saveSessionNotifiedClaims(notifiedClaims);
          isInitialLoadRef.current = false;
          return;
        }

        // 2. Pada snapshot berikutnya: Cari pesanan yang status customerClaimedPaid berubah dari false ke true
        const newlyClaimedOrders = orders.filter(
          (o) => o.customerClaimedPaid && o.paymentStatus !== 'LUNAS' && !notifiedClaims.has(o.id)
        );

        if (newlyClaimedOrders.length === 0) return;

        for (const order of newlyClaimedOrders) {
          // Tandai order sebagai sudah diproses di memori sesi SEBELUM audio diputar
          // agar jika ada snapshot susulan tidak memicu notifikasi ganda
          notifiedClaims.add(order.id);
          saveSessionNotifiedClaims(notifiedClaims);

          // ATURAN UTAMA:
          // Bila pesanan masih BARU saat klaim:
          // Alarm pesanan baru yang sedang berbunyi tetap berlanjut sampai diterima,
          // banner klaim tampil di kartu dan popup TANPA suara tambahan.
          if (order.status === 'BARU') {
            continue;
          }

          // Klaim bayar pada pesanan non-BARU (misalnya DITERIMA):
          // Tampilkan toast dan banner kuning menetap di kartu: "CUSTOMER MENGKLAIM SUDAH BAYAR - cek dana masuk Rp X"
          const payable = order.payableAmount || order.totalPrice;
          const nominalFormatted = formatRupiah(payable);

          addToastRef.current(
            'info',
            `CUSTOMER MENGKLAIM SUDAH BAYAR - cek dana masuk ${nominalFormatted} (Meja ${order.tableNumber})`
          );

          // Putar SEKALI nada pendek khusus lalu suara paymentVoiceText (tidak berulang)
          const isMuted = isCurrentlyMutedRef.current();
          if (soundEnabledRef.current && !isMuted && !isPlayingAudioRef.current) {
            isPlayingAudioRef.current = true;
            try {
              const template =
                settingsRef.current?.paymentVoiceText ||
                DEFAULT_SETTINGS.paymentVoiceText ||
                'Pelanggan meja {meja} atas nama {nama} menyatakan sudah membayar {total}. Silakan cek mutasi.';

              const formattedVoice = formatVoiceOrderText(template, {
                orderCode: order.orderCode,
                tableNumber: order.tableNumber,
                customerName: order.customerName,
                payableAmount: order.payableAmount,
                totalPrice: order.totalPrice,
                items: order.items,
              });

              await audioEngine.playPaymentClaimNotification({
                voiceText: formattedVoice,
                volume: volumeRef.current,
              });
            } catch (err) {
              console.warn('[PaymentClaimNotification] Audio playback error:', err);
            } finally {
              isPlayingAudioRef.current = false;
            }
          }
        }
      },
      (error) => {
        console.warn('[PaymentClaimListener] Gagal memuat snapshot klaim bayar:', error);
      }
    );

    return () => unsubscribe();
  }, [dateKey]);
}
