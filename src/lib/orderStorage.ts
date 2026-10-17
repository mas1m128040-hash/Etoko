import { STORAGE_KEYS } from '../config/constants';
import { Order } from '../types';

const TEN_MINUTES_MS = 10 * 60 * 1000;

/**
 * Menghasilkan kunci penyimpanan lokal yang terikat spesifik ke UID pengguna
 */
export const getUserOrderStorageKey = (uid: string) => `smart_resto_order_${uid}`;

/**
 * Simpan ID pesanan aktif terikat ke UID pengguna di localStorage & sessionStorage
 */
export const saveActiveOrderForUser = (uid: string, orderId: string) => {
  if (!uid || !orderId) return;
  try {
    const key = getUserOrderStorageKey(uid);
    localStorage.setItem(key, orderId);
    sessionStorage.setItem(key, orderId);
  } catch (err) {
    console.warn('[Storage] Gagal menyimpan pesanan untuk user:', err);
  }
};

/**
 * Ambil ID pesanan aktif milik UID pengguna dari sessionStorage / localStorage
 */
export const getActiveOrderForUser = (uid: string): string | null => {
  if (!uid) return null;
  try {
    const key = getUserOrderStorageKey(uid);
    return sessionStorage.getItem(key) || localStorage.getItem(key) || null;
  } catch {
    return null;
  }
};

/**
 * Bersihkan pesanan aktif milik UID pengguna
 */
export const clearActiveOrderForUser = (uid?: string) => {
  try {
    if (uid) {
      const key = getUserOrderStorageKey(uid);
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
    // Bersihkan juga referensi legacy tanpa UID
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_ORDER_ID);
    localStorage.removeItem('smart_resto_active_order_id');
    sessionStorage.removeItem(STORAGE_KEYS.ACTIVE_ORDER_ID);
    sessionStorage.removeItem('smart_resto_active_order_id');
  } catch (err) {
    console.warn('[Storage] Gagal membersihkan referensi pesanan user:', err);
  }
};

/**
 * Membersihkan semua referensi pesanan lokal legacy
 */
export const cleanLocalOrderReferences = (uid?: string) => {
  clearActiveOrderForUser(uid);
};

/**
 * Memeriksa status pesanan yang tersimpan di lokal (localStorage / sessionStorage).
 * Bila pesanan tersebut sudah SELESAI lebih dari 10 menit atau DIBATALKAN,
 * bersihkan referensi pesanan dari penyimpanan lokal.
 */
export const checkAndCleanStaleLocalOrders = (orders: Order[], uid?: string) => {
  try {
    const savedActiveOrderId = uid
      ? getActiveOrderForUser(uid)
      : localStorage.getItem('smart_resto_active_order_id') ||
        sessionStorage.getItem('smart_resto_active_order_id');

    if (!savedActiveOrderId) return;

    const matchingOrder = orders.find((o) => o.id === savedActiveOrderId);
    if (!matchingOrder) {
      return;
    }

    if (matchingOrder.status === 'DIBATALKAN') {
      clearActiveOrderForUser(uid);
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
        clearActiveOrderForUser(uid);
      }
    }
  } catch (err) {
    console.warn('[Storage] Error memeriksa kadaluarsa pesanan lokal:', err);
  }
};

/**
 * Validasi saat order dibuka di halaman status pesanan customer
 */
export const handleSingleOrderStatusCleanup = (order: Order, uid?: string) => {
  try {
    if (order.status === 'DIBATALKAN') {
      clearActiveOrderForUser(uid || order.customerUid);
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
        clearActiveOrderForUser(uid || order.customerUid);
      }
    }
  } catch (err) {
    console.warn('[Storage] Error single order cleanup:', err);
  }
};
