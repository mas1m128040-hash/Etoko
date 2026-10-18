import { STORAGE_KEYS } from '../config/constants';
import { Order } from '../types';

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
 * Bila pesanan tersebut sudah SELESAI atau DIBATALKAN,
 * langsung bersihkan referensi pesanan dari penyimpanan lokal seketika tanpa masa tunggu.
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

    // Begitu pesanan SELESAI atau DIBATALKAN, langsung bersihkan tanpa jeda
    if (matchingOrder.status === 'SELESAI' || matchingOrder.status === 'DIBATALKAN') {
      clearActiveOrderForUser(uid);
    }
  } catch (err) {
    console.warn('[Storage] Error memeriksa status pesanan lokal:', err);
  }
};

/**
 * Validasi dan pembersihan langsung saat order diproses di halaman status pesanan customer
 * Begitu pesanan berubah menjadi SELESAI atau DIBATALKAN, segera hapus dari storage lokal.
 */
export const handleSingleOrderStatusCleanup = (order: Order, uid?: string) => {
  try {
    if (order.status === 'SELESAI' || order.status === 'DIBATALKAN') {
      clearActiveOrderForUser(uid || order.customerUid);
    }
  } catch (err) {
    console.warn('[Storage] Error single order cleanup:', err);
  }
};

