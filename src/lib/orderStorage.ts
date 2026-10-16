import { STORAGE_KEYS } from '../config/constants';
import { Order } from '../types';

const TEN_MINUTES_MS = 10 * 60 * 1000;

/**
 * Membersihkan semua referensi pesanan lokal dari localStorage dan sessionStorage
 */
export const cleanLocalOrderReferences = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_ORDER_ID);
    localStorage.removeItem('smart_resto_active_order_id');
    sessionStorage.removeItem(STORAGE_KEYS.ACTIVE_ORDER_ID);
    sessionStorage.removeItem('smart_resto_active_order_id');
  } catch (err) {
    console.warn('[Storage] Gagal membersihkan referensi pesanan lokal:', err);
  }
};

/**
 * Memeriksa status pesanan yang tersimpan di lokal (localStorage / sessionStorage).
 * Bila pesanan tersebut sudah SELESAI lebih dari 10 menit atau DIBATALKAN,
 * bersihkan referensi pesanan dari penyimpanan lokal.
 */
export const checkAndCleanStaleLocalOrders = (orders: Order[]) => {
  try {
    const savedActiveOrderId =
      localStorage.getItem(STORAGE_KEYS.ACTIVE_ORDER_ID) ||
      localStorage.getItem('smart_resto_active_order_id') ||
      sessionStorage.getItem(STORAGE_KEYS.ACTIVE_ORDER_ID) ||
      sessionStorage.getItem('smart_resto_active_order_id');

    if (!savedActiveOrderId) return;

    const matchingOrder = orders.find((o) => o.id === savedActiveOrderId);
    if (!matchingOrder) {
      // Jika pesanan tidak ada lagi di daftar pesanan aktif server
      return;
    }

    if (matchingOrder.status === 'DIBATALKAN') {
      cleanLocalOrderReferences();
      return;
    }

    if (matchingOrder.status === 'SELESAI') {
      const completedMs = matchingOrder.completedAt?.toMillis
        ? matchingOrder.completedAt.toMillis()
        : matchingOrder.completedAt?.seconds
        ? matchingOrder.completedAt.seconds * 1000
        : matchingOrder.updatedAt?.toMillis
        ? matchingOrder.updatedAt.toMillis()
        : matchingOrder.updatedAt?.seconds
        ? matchingOrder.updatedAt.seconds * 1000
        : null;

      if (!completedMs || Date.now() - completedMs > TEN_MINUTES_MS) {
        cleanLocalOrderReferences();
      }
    }
  } catch (err) {
    console.warn('[Storage] Error memeriksa kadaluarsa pesanan lokal:', err);
  }
};

/**
 * Validasi saat order dibuka di halaman status pesanan customer
 */
export const handleSingleOrderStatusCleanup = (order: Order) => {
  try {
    if (order.status === 'DIBATALKAN') {
      cleanLocalOrderReferences();
      return;
    }

    if (order.status === 'SELESAI') {
      const completedMs = order.completedAt?.toMillis
        ? order.completedAt.toMillis()
        : order.completedAt?.seconds
        ? order.completedAt.seconds * 1000
        : order.updatedAt?.toMillis
        ? order.updatedAt.toMillis()
        : order.updatedAt?.seconds
        ? order.updatedAt.seconds * 1000
        : null;

      if (completedMs && Date.now() - completedMs > TEN_MINUTES_MS) {
        cleanLocalOrderReferences();
      }
    }
  } catch (err) {
    console.warn('[Storage] Error single order cleanup:', err);
  }
};
