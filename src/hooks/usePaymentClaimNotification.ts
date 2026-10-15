import { useEffect, useRef } from 'react';
import { orderService } from '../services/orderService';
import { useSettings } from './useSettings';
import { useSoundStore } from '../store/soundStore';
import { useUiStore } from '../store/uiStore';
import { audioEngine } from '../lib/audioEngine';
import { getDateKeyJakarta, formatRupiah, formatVoiceOrderText } from '../lib/formatters';
import { DEFAULT_SETTINGS } from '../config/constants';

export function usePaymentClaimNotification() {
  const { settings } = useSettings();
  const { soundEnabled, volume, isCurrentlyMuted } = useSoundStore();
  const { addToast } = useUiStore();

  const isInitialLoadRef = useRef<boolean>(true);
  const knownClaimedIdsRef = useRef<Set<string>>(new Set());
  const dateKey = getDateKeyJakarta(new Date());

  useEffect(() => {
    isInitialLoadRef.current = true;
    knownClaimedIdsRef.current = new Set();

    const unsubscribe = orderService.subscribeTodayOrders(
      dateKey,
      (orders) => {
        // 1. Pada pemuatan pertama (atau re-mount), inisialisasi daftar pesanan yang sudah berstatus claimed
        // JANGAN memutar nada atau suara saat halaman baru dimuat ulang / listener tersambung kembali
        if (isInitialLoadRef.current) {
          orders.forEach((o) => {
            if (o.customerClaimedPaid) {
              knownClaimedIdsRef.current.add(o.id);
            }
          });
          isInitialLoadRef.current = false;
          return;
        }

        // 2. Pada snapshot berikutnya: Cari pesanan yang status customerClaimedPaid berubah dari false menjadi true
        const newlyClaimedOrders = orders.filter(
          (o) => o.customerClaimedPaid && !knownClaimedIdsRef.current.has(o.id)
        );

        if (newlyClaimedOrders.length === 0) return;

        // Tandai order sebagai sudah diproses notifikasinya agar tidak memutar ulang
        newlyClaimedOrders.forEach((order) => {
          knownClaimedIdsRef.current.add(order.id);

          const payable = order.payableAmount || order.totalPrice;
          const nominalFormatted = formatRupiah(payable);

          // Tampilkan Toast
          addToast(
            'info',
            `Meja ${order.tableNumber} menyatakan sudah bayar ${nominalFormatted}`
          );

          // Bunyikan nada pendek khusus pembayaran + Web Speech API suara orang (id-ID) SEKALI
          const isMuted = isCurrentlyMuted();
          if (soundEnabled && !isMuted) {
            const template =
              settings?.paymentVoiceText ||
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

            audioEngine.playPaymentClaimNotification({
              voiceText: formattedVoice,
              volume,
            });
          }
        });
      },
      (error) => {
        console.warn('[PaymentClaimListener] Gagal memuat snapshot klaim bayar:', error);
      }
    );

    return () => unsubscribe();
  }, [dateKey, settings?.paymentVoiceText, soundEnabled, volume, isCurrentlyMuted, addToast]);
}
