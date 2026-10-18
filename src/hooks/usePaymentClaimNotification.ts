import { useEffect, useRef } from 'react';
import { orderService } from '../services/orderService';
import { useSettings } from './useSettings';
import { useSoundStore } from '../store/soundStore';
import { useUiStore } from '../store/uiStore';
import { useClaimPopupStore } from '../store/claimPopupStore';
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
  const { addClaim, removeClaim } = useClaimPopupStore();

  const isInitialLoadRef = useRef<boolean>(true);
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

  const addClaimRef = useRef(addClaim);
  addClaimRef.current = addClaim;

  const removeClaimRef = useRef(removeClaim);
  removeClaimRef.current = removeClaim;

  useEffect(() => {
    isInitialLoadRef.current = true;
    const notifiedClaims = getSessionNotifiedClaims();

    const unsubscribe = orderService.subscribeTodayOrders(
      dateKey,
      (orders) => {
        // 1. Bersihkan popup untuk setiap pesanan yang sudah LUNAS, DIBATALKAN, atau SELESAI
        orders.forEach((o) => {
          if (
            o.paymentStatus === 'LUNAS' ||
            o.status === 'DIBATALKAN' ||
            o.status === 'SELESAI'
          ) {
            removeClaimRef.current(o.id);
          }
        });

        // 2. Pada pemuatan pertama / re-mount / listener tersambung kembali:
        // Klaim yang sudah ada dicatat sebagai sudah diumumkan agar tidak dibunyikan ulang saat halaman dimuat,
        // TETAPI klaim belum lunas yang masih aktif tetap dimasukkan ke popup lewat addClaim tanpa suara.
        if (isInitialLoadRef.current) {
          orders.forEach((o) => {
            if (o.customerClaimedPaid) {
              notifiedClaims.add(o.id);
              if (
                o.paymentStatus !== 'LUNAS' &&
                o.status !== 'DIBATALKAN' &&
                o.status !== 'SELESAI'
              ) {
                const payable = o.payableAmount || o.totalPrice;
                addClaimRef.current({
                  orderId: o.id,
                  orderCode: o.orderCode,
                  tableNumber: o.tableNumber,
                  customerName: o.customerName,
                  amount: payable,
                });
              }
            }
          });
          saveSessionNotifiedClaims(notifiedClaims);
          isInitialLoadRef.current = false;
          return;
        }

        // 3. Pada snapshot berikutnya: Cari pesanan yang status customerClaimedPaid berubah dari false ke true
        // Klaim bayar selalu diumumkan, apa pun status pesanannya (BARU atau DITERIMA),
        // selama paymentStatus belum LUNAS dan status bukan DIBATALKAN atau SELESAI.
        const newlyClaimedOrders = orders.filter(
          (o) =>
            o.customerClaimedPaid &&
            o.paymentStatus !== 'LUNAS' &&
            o.status !== 'DIBATALKAN' &&
            o.status !== 'SELESAI' &&
            !notifiedClaims.has(o.id)
        );

        if (newlyClaimedOrders.length === 0) return;

        for (const order of newlyClaimedOrders) {
          // Tandai order sebagai sudah diproses di memori sesi SEBELUM audio diputar
          // agar jika ada snapshot susulan tidak memicu notifikasi ganda
          notifiedClaims.add(order.id);
          saveSessionNotifiedClaims(notifiedClaims);

          const payable = order.payableAmount || order.totalPrice;
          const nominalFormatted = formatRupiah(payable);

          // Masukkan ke popup klaim bayar
          addClaimRef.current({
            orderId: order.id,
            orderCode: order.orderCode,
            tableNumber: order.tableNumber,
            customerName: order.customerName,
            amount: payable,
          });

          // Tampilkan toast
          addToastRef.current(
            'info',
            `CUSTOMER MENGKLAIM SUDAH BAYAR - cek dana masuk ${nominalFormatted} (Meja ${order.tableNumber})`
          );

          // Jika suara aktif dan tidak dimute, antrekan pengumuman suara ke audioEngine
          const isMuted = isCurrentlyMutedRef.current();
          if (soundEnabledRef.current && !isMuted) {
            const template =
              settingsRef.current?.paymentVoiceText ||
              DEFAULT_SETTINGS.paymentVoiceText ||
              'Pelanggan meja {meja} atas nama {nama} menyatakan sudah membayar {total}. Silakan cek dana masuk.';

            const formattedVoice = formatVoiceOrderText(template, {
              orderCode: order.orderCode,
              tableNumber: order.tableNumber,
              customerName: order.customerName,
              payableAmount: order.payableAmount,
              totalPrice: order.totalPrice,
              items: order.items,
            });

            audioEngine.enqueueAnnouncement({
              kind: 'CLAIM',
              voiceText: formattedVoice,
              volume: volumeRef.current,
            });
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
