import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Order, DailyStats } from '../types';
import { getDateKeyJakarta } from '../lib/formatters';

const DAILY_STATS_COL = 'dailyStats';
const ORDERS_COL = 'orders';

export interface ReportSummary {
  revenue: number; // Omset pesanan LUNAS (tanpa kode unik)
  cashIn: number; // Uang Masuk pesanan LUNAS (termasuk kode unik)
  paidCount: number; // Jumlah Pesanan Lunas
  averagePerOrder: number; // Rata-rata per Pesanan (revenue / paidCount)
  unpaidCount: number; // Jumlah belum lunas
  unpaidAmount: number; // Nominal belum lunas
  cancelledCount: number; // Jumlah pesanan dibatalkan
  totalOrders: number;
  byMethod: {
    TUNAI: number;
    QRIS: number;
    TRANSFER: number;
  };
  topItems: { name: string; qty: number }[];
}

export function calculateStatsFromOrders(orders: Order[], dateKey: string): DailyStats {
  const orderCount = orders.length;
  const paidOrders = orders.filter(
    (o) => o.paymentStatus === 'LUNAS' && o.status !== 'DIBATALKAN'
  );
  const paidCount = paidOrders.length;
  const revenue = paidOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
  const cashIn = paidOrders.reduce(
    (sum, o) => sum + (o.payableAmount || o.totalPrice || 0),
    0
  );

  const byMethod = {
    TUNAI: 0,
    QRIS: 0,
    TRANSFER: 0,
  };

  const topItems: Record<string, number> = {};

  for (const o of paidOrders) {
    const finalMethod =
      o.paidMethodFinal ||
      (o.paymentMethod === 'DI_MEJA' ? 'TUNAI' : o.paymentMethod);
    const amt = o.payableAmount || o.totalPrice || 0;
    if (finalMethod === 'QRIS') {
      byMethod.QRIS += amt;
    } else if (finalMethod === 'TRANSFER') {
      byMethod.TRANSFER += amt;
    } else {
      byMethod.TUNAI += amt;
    }

    if (o.items && Array.isArray(o.items)) {
      for (const item of o.items) {
        if (item.name) {
          topItems[item.name] = (topItems[item.name] || 0) + (item.qty || 1);
        }
      }
    }
  }

  const cancelledCount = orders.filter((o) => o.status === 'DIBATALKAN').length;
  const unpaidOrders = orders.filter(
    (o) => o.paymentStatus === 'BELUM_BAYAR' && o.status !== 'DIBATALKAN'
  );
  const unpaidCount = unpaidOrders.length;
  const unpaidAmount = unpaidOrders.reduce(
    (sum, o) => sum + (o.payableAmount || o.totalPrice || 0),
    0
  );

  return {
    dateKey,
    orderCount,
    paidCount,
    revenue,
    cashIn,
    byMethod,
    cancelledCount,
    unpaidCount,
    unpaidAmount,
    topItems,
  };
}

export const reportService = {
  /**
   * Ambil data dailyStats untuk 1 tanggal.
   * - Jika dateKey == hari ini, hitung live dari todayOrders tanpa query baru
   * - Jika hari lampau, baca dailyStats. Jika belum ada, hitung ulang dari orders dan simpan (idempotent)
   */
  async getDailyStatsForDate(
    dateKey: string,
    todayLiveOrders?: Order[]
  ): Promise<DailyStats> {
    const todayDateKey = getDateKeyJakarta(new Date());

    if (dateKey === todayDateKey && todayLiveOrders) {
      return calculateStatsFromOrders(todayLiveOrders, dateKey);
    }

    // Coba baca dari koleksi dailyStats
    const statDocRef = doc(db, DAILY_STATS_COL, dateKey);
    const snap = await getDoc(statDocRef);

    if (snap.exists()) {
      const data = snap.data();
      return {
        id: snap.id,
        dateKey,
        orderCount: Number(data.orderCount) || 0,
        paidCount: Number(data.paidCount) || 0,
        revenue: Number(data.revenue) || 0,
        cashIn: Number(data.cashIn) || 0,
        byMethod: {
          TUNAI: Number(data.byMethod?.TUNAI) || 0,
          QRIS: Number(data.byMethod?.QRIS) || 0,
          TRANSFER: Number(data.byMethod?.TRANSFER) || 0,
        },
        cancelledCount: Number(data.cancelledCount) || 0,
        unpaidCount: Number(data.unpaidCount) || 0,
        unpaidAmount: Number(data.unpaidAmount) || 0,
        topItems: (data.topItems as Record<string, number>) || {},
        updatedAt: data.updatedAt,
      };
    }

    // Jika belum ada dokumen dailyStats untuk hari tersebut, hitung dari orders lalu simpan
    const ordersQuery = query(
      collection(db, ORDERS_COL),
      where('dateKey', '==', dateKey)
    );
    const ordersSnap = await getDocs(ordersQuery);
    const ordersList = ordersSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Order[];

    const computed = calculateStatsFromOrders(ordersList, dateKey);

    // Simpan ke Firestore secara idempotent jika hari lampau
    if (dateKey !== todayDateKey) {
      try {
        await setDoc(
          statDocRef,
          {
            ...computed,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (err) {
        console.warn('Gagal menyimpan cache dailyStats:', err);
      }
    }

    return computed;
  },

  /**
   * Ambil data untuk seluruh tanggal dalam rentang [startDateKey, endDateKey]
   */
  async getReportForRange(
    dateKeys: string[],
    todayLiveOrders?: Order[]
  ): Promise<{ daily: DailyStats[]; summary: ReportSummary }> {
    const todayDateKey = getDateKeyJakarta(new Date());

    const promises = dateKeys.map((dk) =>
      this.getDailyStatsForDate(
        dk,
        dk === todayDateKey ? todayLiveOrders : undefined
      )
    );

    const daily = await Promise.all(promises);

    // Hitung ringkasan akumulatif
    let revenue = 0;
    let cashIn = 0;
    let paidCount = 0;
    let unpaidCount = 0;
    let unpaidAmount = 0;
    let cancelledCount = 0;
    let totalOrders = 0;
    const byMethod = { TUNAI: 0, QRIS: 0, TRANSFER: 0 };
    const aggregatedTopItems: Record<string, number> = {};

    for (const d of daily) {
      revenue += d.revenue;
      cashIn += d.cashIn;
      paidCount += d.paidCount;
      unpaidCount += d.unpaidCount;
      unpaidAmount += d.unpaidAmount;
      cancelledCount += d.cancelledCount;
      totalOrders += d.orderCount;

      byMethod.TUNAI += d.byMethod.TUNAI;
      byMethod.QRIS += d.byMethod.QRIS;
      byMethod.TRANSFER += d.byMethod.TRANSFER;

      if (d.topItems) {
        for (const [itemName, qty] of Object.entries(d.topItems)) {
          aggregatedTopItems[itemName] =
            (aggregatedTopItems[itemName] || 0) + (Number(qty) || 0);
        }
      }
    }

    const averagePerOrder = paidCount > 0 ? Math.round(revenue / paidCount) : 0;

    const topItems = Object.entries(aggregatedTopItems)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    const summary: ReportSummary = {
      revenue,
      cashIn,
      paidCount,
      averagePerOrder,
      unpaidCount,
      unpaidAmount,
      cancelledCount,
      totalOrders,
      byMethod,
      topItems,
    };

    return { daily, summary };
  },

  /**
   * Ekspor laporan ke file CSV langsung di browser
   */
  exportToCsv(dailyList: DailyStats[], periodLabel: string): void {
    const headers = [
      'Tanggal',
      'Total Pesanan',
      'Pesanan Lunas',
      'Omset (Rp)',
      'Uang Masuk (Rp)',
      'Tunai (Rp)',
      'QRIS (Rp)',
      'Transfer (Rp)',
      'Belum Lunas (Pesanan)',
      'Belum Lunas (Rp)',
      'Dibatalkan',
    ];

    const rows = dailyList.map((d) => [
      d.dateKey,
      d.orderCount,
      d.paidCount,
      d.revenue,
      d.cashIn,
      d.byMethod.TUNAI,
      d.byMethod.QRIS,
      d.byMethod.TRANSFER,
      d.unpaidCount,
      d.unpaidAmount,
      d.cancelledCount,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.map((cell) => `"${cell}"`).join(',')),
    ].join('\r\n');

    const blob = new Blob(['\uFEFF' + csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `laporan-penjualan-${periodLabel.toLowerCase().replace(/\s+/g, '-')}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};
