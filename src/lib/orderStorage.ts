import { STORAGE_KEYS } from '../config/constants';
import { Order } from '../types';
import { getDeviceId } from './deviceId';

/**
 * Menghasilkan kunci penyimpanan lokal yang terikat spesifik ke UID pengguna
 */
export const getUserOrderStorageKey = (uid: string) => `smart_resto_order_${uid}`;

/**
 * Simpan ID pesanan aktif terikat ke UID pengguna di localStorage & sessionStorage
 */
export const saveActiveOrderForUser = (uid: string | null | undefined, orderId: string) => {
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
export const getActiveOrderForUser = (uid: string | null | undefined): string | null => {
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
export const clearActiveOrderForUser = (uid?: string | null) => {
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
export const cleanLocalOrderReferences = (uid?: string | null) => {
  clearActiveOrderForUser(uid);
};

/**
 * Memeriksa status pesanan yang tersimpan di lokal (localStorage / sessionStorage).
 * - Bila pesanan memiliki deviceId yang berbeda dari perangkat ini, bersihkan referensi lokalnya.
 * - Bila pesanan tersebut sudah SELESAI atau DIBATALKAN, bersihkan referensi lokalnya seketika.
 */
export const checkAndCleanStaleLocalOrders = (orders: Order[], uid?: string | null) => {
  try {
    const savedActiveOrderId = uid
      ? getActiveOrderForUser(uid)
      : localStorage.getItem('smart_resto_active_order_id') ||
        sessionStorage.getItem('smart_resto_active_order_id');

    if (!savedActiveOrderId) return;

    const matchingOrder = orders.find((o) => o.id === savedActiveOrderId);
    if (!matchingOrder) {
      // Dokumen pesanan sudah tidak ada di database (misal data telah dibersihkan / dihapus)
      clearActiveOrderForUser(uid);
      return;
    }

    const currentDeviceId = getDeviceId();
    // Jika dokumen punya deviceId yang berbeda, perlakukan sebagai bukan milik perangkat ini
    if (matchingOrder.deviceId && matchingOrder.deviceId !== currentDeviceId) {
      clearActiveOrderForUser(uid);
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
 * - Jika dokumen punya deviceId berbeda, bersihkan referensi lokalnya.
 * - Begitu pesanan berubah menjadi SELESAI atau DIBATALKAN, segera hapus dari storage lokal.
 */
export const handleSingleOrderStatusCleanup = (order: Order, uid?: string | null) => {
  try {
    const currentDeviceId = getDeviceId();
    // Jika dokumen punya deviceId yang berbeda, perlakukan sebagai bukan milik perangkat ini
    if (order.deviceId && order.deviceId !== currentDeviceId) {
      clearActiveOrderForUser(uid || order.customerUid);
      return;
    }

    if (order.status === 'SELESAI' || order.status === 'DIBATALKAN') {
      clearActiveOrderForUser(uid || order.customerUid);
    }
  } catch (err) {
    console.warn('[Storage] Error single order cleanup:', err);
  }
};


