import {
  collection,
  doc,
  getDocs,
  getCountFromServer,
  query,
  where,
  limit,
  writeBatch,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Order, DailyStats } from '../types';

export type ResetScope = 'ALL' | 'BEFORE_DATE';

export interface ResetCollectionsSelection {
  orders: boolean;
  dailyStats: boolean;
  paymentLogs: boolean;
  counters: boolean;
}

export interface ResetCounts {
  orders: number;
  dailyStats: number;
  paymentLogs: number;
  counters: number;
  activeOrders: number;
  total: number;
}

export interface ResetProgress {
  currentCollection: 'orders' | 'paymentLogs' | 'dailyStats' | 'counters' | 'selesai';
  deletedOrders: number;
  deletedPaymentLogs: number;
  deletedDailyStats: number;
  deletedCounters: number;
  totalDeleted: number;
  totalEstimated: number;
  percentage: number;
}

export interface ResetExecutionResult {
  success: boolean;
  stoppedByAdmin?: boolean;
  error?: string;
  errorCode?: string;
  failedCollection?: string;
  deletedCounts: {
    orders: number;
    dailyStats: number;
    paymentLogs: number;
    counters: number;
    total: number;
  };
}

const ORDERS_COL = 'orders';
const DAILY_STATS_COL = 'dailyStats';
const PAYMENT_LOGS_COL = 'paymentLogs';
const COUNTERS_COL = 'counters';
const BATCH_SIZE = 400;

export const dataResetService = {
  /**
   * Menghitung jumlah dokumen yang akan terpengaruh pada setiap koleksi
   */
  async getResetCounts(
    scope: ResetScope,
    cutoffDate?: string,
    selection?: ResetCollectionsSelection
  ): Promise<ResetCounts> {
    const sel: ResetCollectionsSelection = selection || {
      orders: true,
      dailyStats: true,
      paymentLogs: true,
      counters: scope === 'ALL',
    };

    let ordersCount = 0;
    let activeOrdersCount = 0;
    let dailyStatsCount = 0;
    let paymentLogsCount = 0;
    let countersCount = 0;

    // 1. Hitung Orders & Active Orders
    if (sel.orders) {
      try {
        const baseOrderQuery =
          scope === 'BEFORE_DATE' && cutoffDate
            ? query(collection(db, ORDERS_COL), where('dateKey', '<', cutoffDate))
            : collection(db, ORDERS_COL);

        const snap = await getCountFromServer(baseOrderQuery);
        ordersCount = snap.data().count;

        // Hitung pesanan aktif: BARU, DITERIMA, atau BELUM_BAYAR (yang bukan DIBATALKAN)
        // Lakukan query ringan terfokus
        const activeStatusQuery =
          scope === 'BEFORE_DATE' && cutoffDate
            ? query(
                collection(db, ORDERS_COL),
                where('dateKey', '<', cutoffDate),
                where('status', 'in', ['BARU', 'DITERIMA'])
              )
            : query(
                collection(db, ORDERS_COL),
                where('status', 'in', ['BARU', 'DITERIMA'])
              );
        const activeSnap = await getCountFromServer(activeStatusQuery);
        activeOrdersCount = activeSnap.data().count;

        // Tambahkan pesanan yang BELUM_BAYAR (bila status bukan BARU/DITERIMA dan bukan DIBATALKAN, misal di status lain)
        const unpaidQuery =
          scope === 'BEFORE_DATE' && cutoffDate
            ? query(
                collection(db, ORDERS_COL),
                where('dateKey', '<', cutoffDate),
                where('paymentStatus', '==', 'BELUM_BAYAR')
              )
            : query(
                collection(db, ORDERS_COL),
                where('paymentStatus', '==', 'BELUM_BAYAR')
              );
        const unpaidSnap = await getDocs(unpaidQuery);
        unpaidSnap.docs.forEach((d) => {
          const data = d.data();
          if (data.status !== 'BARU' && data.status !== 'DITERIMA' && data.status !== 'DIBATALKAN') {
            activeOrdersCount++;
          }
        });
      } catch (err) {
        console.warn('[dataResetService] Gagal menghitung orders:', err);
      }
    }

    // 2. Hitung DailyStats
    if (sel.dailyStats) {
      try {
        const baseDailyQuery =
          scope === 'BEFORE_DATE' && cutoffDate
            ? query(collection(db, DAILY_STATS_COL), where('dateKey', '<', cutoffDate))
            : collection(db, DAILY_STATS_COL);

        const snap = await getCountFromServer(baseDailyQuery);
        dailyStatsCount = snap.data().count;
      } catch (err) {
        console.warn('[dataResetService] Gagal menghitung dailyStats:', err);
      }
    }

    // 3. Hitung PaymentLogs
    if (sel.paymentLogs) {
      try {
        const baseLogsQuery =
          scope === 'BEFORE_DATE' && cutoffDate
            ? query(collection(db, PAYMENT_LOGS_COL), where('dateKey', '<', cutoffDate))
            : collection(db, PAYMENT_LOGS_COL);

        const snap = await getCountFromServer(baseLogsQuery);
        paymentLogsCount = snap.data().count;
      } catch {
        // Koleksi paymentLogs mungkin belum pernah dibuat di database
        paymentLogsCount = 0;
      }
    }

    // 4. Hitung Counters (Hanya aktif bila cakupan SEMUA)
    if (sel.counters && scope === 'ALL') {
      try {
        const snap = await getCountFromServer(collection(db, COUNTERS_COL));
        countersCount = snap.data().count;
      } catch (err) {
        console.warn('[dataResetService] Gagal menghitung counters:', err);
      }
    }

    const total = ordersCount + dailyStatsCount + paymentLogsCount + countersCount;

    return {
      orders: ordersCount,
      dailyStats: dailyStatsCount,
      paymentLogs: paymentLogsCount,
      counters: countersCount,
      activeOrders: activeOrdersCount,
      total,
    };
  },

  /**
   * Mengunduh cadangan lengkap dalam format JSON
   */
  async downloadBackupJson(
    scope: ResetScope,
    cutoffDate?: string,
    selection?: ResetCollectionsSelection
  ): Promise<boolean> {
    const sel = selection || {
      orders: true,
      dailyStats: true,
      paymentLogs: true,
      counters: scope === 'ALL',
    };

    const backupData: Record<string, any> = {
      exportedAt: new Date().toISOString(),
      scope,
      cutoffDate: cutoffDate || null,
      orders: [],
      dailyStats: [],
      paymentLogs: [],
      counters: [],
    };

    // Ambil Orders
    if (sel.orders) {
      const q =
        scope === 'BEFORE_DATE' && cutoffDate
          ? query(collection(db, ORDERS_COL), where('dateKey', '<', cutoffDate))
          : collection(db, ORDERS_COL);
      const snap = await getDocs(q);
      backupData.orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }

    // Ambil DailyStats
    if (sel.dailyStats) {
      const q =
        scope === 'BEFORE_DATE' && cutoffDate
          ? query(collection(db, DAILY_STATS_COL), where('dateKey', '<', cutoffDate))
          : collection(db, DAILY_STATS_COL);
      const snap = await getDocs(q);
      backupData.dailyStats = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }

    // Ambil PaymentLogs
    if (sel.paymentLogs) {
      try {
        const q =
          scope === 'BEFORE_DATE' && cutoffDate
            ? query(collection(db, PAYMENT_LOGS_COL), where('dateKey', '<', cutoffDate))
            : collection(db, PAYMENT_LOGS_COL);
        const snap = await getDocs(q);
        backupData.paymentLogs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch {
        backupData.paymentLogs = [];
      }
    }

    // Ambil Counters
    if (sel.counters && scope === 'ALL') {
      try {
        const snap = await getDocs(collection(db, COUNTERS_COL));
        backupData.counters = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch {
        backupData.counters = [];
      }
    }

    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `backup-smart-resto-${scope.toLowerCase()}-${timestamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  },

  /**
   * Mengunduh cadangan pesanan dalam format CSV
   */
  async downloadOrdersCsv(scope: ResetScope, cutoffDate?: string): Promise<boolean> {
    const q =
      scope === 'BEFORE_DATE' && cutoffDate
        ? query(collection(db, ORDERS_COL), where('dateKey', '<', cutoffDate))
        : collection(db, ORDERS_COL);

    const snap = await getDocs(q);
    const orders = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order));

    const headers = [
      'ID Dokumen',
      'Nomor Pesanan',
      'Tanggal',
      'Nomor Meja',
      'Nama Pelanggan',
      'Total Belanja',
      'Nominal Tagihan',
      'Metode Pembayaran',
      'Status Pembayaran',
      'Status Pesanan',
      'Catatan',
      'Rincian Menu',
    ];

    const rows = orders.map((o) => {
      const itemsSummary = (o.items || [])
        .map((i) => `${i.name} (${i.qty}x @${i.price})`)
        .join('; ');

      return [
        `"${o.id || ''}"`,
        `"#${o.orderCode || ''}"`,
        `"${o.dateKey || ''}"`,
        `"Meja ${o.tableNumber || ''}"`,
        `"${(o.customerName || '').replace(/"/g, '""')}"`,
        o.totalPrice || 0,
        o.payableAmount || o.totalPrice || 0,
        `"${o.paymentMethod || ''}"`,
        `"${o.paymentStatus || ''}"`,
        `"${o.status || ''}"`,
        `"${(o.notes || '').replace(/"/g, '""')}"`,
        `"${itemsSummary.replace(/"/g, '""')}"`,
      ].join(',');
    });

    // Gunakan UTF-8 BOM agar terbaca sempurna di Microsoft Excel
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `pesanan-smart-resto-${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  },

  /**
   * Eksekusi penghapusan bertahap berpaginasi (writeBatch maksimal 400 dokumen per batch).
   * Urutan: orders, paymentLogs, dailyStats, counters (terakhir).
   * Membaca dari server dengan limit(400) dan mengulangi sampai habis.
   */
  async executeReset(
    scope: ResetScope,
    cutoffDate: string | undefined,
    selection: ResetCollectionsSelection,
    adminIdentifier: string,
    onProgress: (progress: ResetProgress) => void,
    shouldCancel: () => boolean,
    resumeState?: {
      startCollection?: 'orders' | 'paymentLogs' | 'dailyStats' | 'counters';
      alreadyDeleted?: {
        orders: number;
        paymentLogs: number;
        dailyStats: number;
        counters: number;
      };
    }
  ): Promise<ResetExecutionResult> {
    const deletedCounts = {
      orders: resumeState?.alreadyDeleted?.orders || 0,
      paymentLogs: resumeState?.alreadyDeleted?.paymentLogs || 0,
      dailyStats: resumeState?.alreadyDeleted?.dailyStats || 0,
      counters: resumeState?.alreadyDeleted?.counters || 0,
      total: 0,
    };

    deletedCounts.total =
      deletedCounts.orders +
      deletedCounts.paymentLogs +
      deletedCounts.dailyStats +
      deletedCounts.counters;

    // Hitung total estimasi awal
    const estCounts = await this.getResetCounts(scope, cutoffDate, selection);
    const totalEstimated = Math.max(estCounts.total, deletedCounts.total || 1);

    const updateProgressState = (
      col: 'orders' | 'paymentLogs' | 'dailyStats' | 'counters' | 'selesai'
    ) => {
      deletedCounts.total =
        deletedCounts.orders +
        deletedCounts.paymentLogs +
        deletedCounts.dailyStats +
        deletedCounts.counters;

      const pct = Math.min(
        100,
        Math.round((deletedCounts.total / totalEstimated) * 100)
      );

      onProgress({
        currentCollection: col,
        deletedOrders: deletedCounts.orders,
        deletedPaymentLogs: deletedCounts.paymentLogs,
        deletedDailyStats: deletedCounts.dailyStats,
        deletedCounters: deletedCounts.counters,
        totalDeleted: deletedCounts.total,
        totalEstimated,
        percentage: pct,
      });
    };

    // Helper untuk menghapus dokumen dalam koleksi secara bertahap dengan pagination 400
    const deleteCollectionInBatches = async (
      collectionName: string,
      colType: 'orders' | 'paymentLogs' | 'dailyStats' | 'counters'
    ) => {
      while (true) {
        if (shouldCancel()) {
          return { stopped: true };
        }

        // Query berpaginasi limit 400 dokumen
        let q =
          scope === 'BEFORE_DATE' && cutoffDate && colType !== 'counters'
            ? query(
                collection(db, collectionName),
                where('dateKey', '<', cutoffDate),
                limit(BATCH_SIZE)
              )
            : query(collection(db, collectionName), limit(BATCH_SIZE));

        const snap = await getDocs(q);
        if (snap.empty || snap.docs.length === 0) {
          // Koleksi ini sudah tuntas
          break;
        }

        const batch = writeBatch(db);
        snap.docs.forEach((docSnap) => {
          batch.delete(docSnap.ref);
        });

        await batch.commit();

        const countInBatch = snap.docs.length;
        if (colType === 'orders') deletedCounts.orders += countInBatch;
        else if (colType === 'paymentLogs') deletedCounts.paymentLogs += countInBatch;
        else if (colType === 'dailyStats') deletedCounts.dailyStats += countInBatch;
        else if (colType === 'counters') deletedCounts.counters += countInBatch;

        updateProgressState(colType);

        // Jika batch yang dikembalikan lebih kecil dari BATCH_SIZE, koleksi sudah habis
        if (countInBatch < BATCH_SIZE) {
          break;
        }
      }

      return { stopped: false };
    };

    const collectionsOrder: Array<{
      id: 'orders' | 'paymentLogs' | 'dailyStats' | 'counters';
      name: string;
      enabled: boolean;
    }> = [
      { id: 'orders', name: ORDERS_COL, enabled: selection.orders },
      { id: 'paymentLogs', name: PAYMENT_LOGS_COL, enabled: selection.paymentLogs },
      { id: 'dailyStats', name: DAILY_STATS_COL, enabled: selection.dailyStats },
      { id: 'counters', name: COUNTERS_COL, enabled: selection.counters && scope === 'ALL' },
    ];

    const startIndex = resumeState?.startCollection
      ? collectionsOrder.findIndex((c) => c.id === resumeState.startCollection)
      : 0;

    for (let i = Math.max(0, startIndex); i < collectionsOrder.length; i++) {
      const item = collectionsOrder[i];
      if (!item.enabled) continue;

      if (shouldCancel()) {
        return {
          success: false,
          stoppedByAdmin: true,
          deletedCounts,
        };
      }

      updateProgressState(item.id);

      try {
        const res = await deleteCollectionInBatches(item.name, item.id);
        if (res.stopped) {
          return {
            success: false,
            stoppedByAdmin: true,
            deletedCounts,
          };
        }
      } catch (err: any) {
        console.error(`[dataResetService] Error pada batch ${item.id}:`, err);
        return {
          success: false,
          errorCode: err?.code || 'BATCH_DELETE_ERROR',
          error: err?.message || String(err),
          failedCollection: item.id,
          deletedCounts,
        };
      }
    }

    // 5. Simpan ringkasan penghapusan di settings/restaurant
    try {
      const settingsRef = doc(db, 'settings', 'restaurant');
      await updateDoc(settingsRef, {
        lastResetAt: serverTimestamp(),
        lastResetBy: adminIdentifier || 'Admin',
        lastResetCounts: {
          orders: deletedCounts.orders,
          dailyStats: deletedCounts.dailyStats,
          paymentLogs: deletedCounts.paymentLogs,
          counters: deletedCounts.counters,
          total: deletedCounts.total,
        },
      });
    } catch (saveErr) {
      console.warn('[dataResetService] Gagal mencatat lastReset di settings:', saveErr);
    }

    updateProgressState('selesai');

    return {
      success: true,
      deletedCounts,
    };
  },
};
