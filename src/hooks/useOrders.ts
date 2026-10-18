import { useState, useEffect, useMemo, useCallback } from 'react';
import { Order } from '../types';
import { orderService } from '../services/orderService';
import { getDateKeyJakarta } from '../lib/formatters';
import { getDeviceId } from '../lib/deviceId';

export function useTodayOrders(customDateKey?: string) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('AKTIF');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [retryTrigger, setRetryTrigger] = useState<number>(0);

  const dateKey = customDateKey || getDateKeyJakarta(new Date());

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    setRetryTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const unsubscribe = orderService.subscribeTodayOrders(
      dateKey,
      (list) => {
        setOrders(list);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [dateKey, retryTrigger]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      let matchesStatus = true;
      if (statusFilter === 'AKTIF') {
        matchesStatus = order.status === 'BARU' || order.status === 'DITERIMA';
      } else if (statusFilter === 'ALL') {
        matchesStatus = true;
      } else if (statusFilter === 'BELUM_BAYAR') {
        matchesStatus =
          order.paymentStatus === 'BELUM_BAYAR' && order.status !== 'DIBATALKAN';
      } else {
        matchesStatus = order.status === statusFilter;
      }

      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        order.orderCode.includes(q) ||
        order.customerName.toLowerCase().includes(q) ||
        order.tableNumber.toLowerCase().includes(q);

      return matchesStatus && matchesQuery;
    });
  }, [orders, statusFilter, searchQuery]);

  // Key metrics: Total, Aktif, Baru, Diterima, Selesai, Dibatalkan, Belum Lunas, Tidak Bayar Hari Ini
  const stats = useMemo(() => {
    const total = orders.length;
    const baru = orders.filter((o) => o.status === 'BARU').length;
    const diterima = orders.filter((o) => o.status === 'DITERIMA').length;
    const aktif = baru + diterima;
    const selesai = orders.filter((o) => o.status === 'SELESAI').length;
    const dibatalkan = orders.filter((o) => o.status === 'DIBATALKAN').length;

    const belumLunasOrders = orders.filter(
      (o) => o.paymentStatus === 'BELUM_BAYAR' && o.status !== 'DIBATALKAN'
    );
    const belumLunasCount = belumLunasOrders.length;
    const belumLunasAmount = belumLunasOrders.reduce(
      (sum, o) => sum + (o.payableAmount || o.totalPrice),
      0
    );

    const tidakBayarHariIni = orders.filter(
      (o) => o.status === 'DIBATALKAN' && o.cancelReason === 'Tidak membayar'
    ).length;

    const totalRevenue = orders
      .filter((o) => o.paymentStatus === 'LUNAS' && o.status !== 'DIBATALKAN')
      .reduce((sum, o) => sum + (o.payableAmount || o.totalPrice), 0);

    return {
      total,
      aktif,
      baru,
      diterima,
      selesai,
      dibatalkan,
      belumLunasCount,
      belumLunasAmount,
      tidakBayarHariIni,
      totalRevenue,
    };
  }, [orders]);

  return {
    orders,
    filteredOrders,
    loading,
    error,
    retry,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    stats,
    dateKey,
  };
}

export function useSingleOrder(orderId: string | undefined) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!orderId) {
      setOrder(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = orderService.subscribeSingleOrder(
      orderId,
      (o) => {
        setOrder(o);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [orderId]);

  return { order, loading, error };
}

/**
 * Hook untuk pesanan pelanggan:
 * - Kueri Firestore HANYA berdasarkan customerUid
 * - Filter sisi customer:
 *   1. customerUid == pengguna
 *   2. tableNumber == meja aktif (jika ada)
 *   3. Pesanan masih aktif (BARU atau DITERIMA, atau BELUM_BAYAR bukan DIBATALKAN dan bukan SELESAI)
 *   4. Pesanan SELESAI atau DIBATALKAN langsung hilang seketika tanpa masa tunggu 10 menit
 */
export function useCustomerOrders(
  customerUid: string | undefined,
  activeTableNumber?: string
) {
  const [rawOrders, setRawOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customerUid) {
      setRawOrders([]);
      setLoading(false);
      return;
    }

    const unsubscribe = orderService.subscribeCustomerOrders(
      customerUid,
      (list) => {
        setRawOrders(list);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsubscribe();
  }, [customerUid]);

  const orders = useMemo(() => {
    if (!customerUid) return [];

    return rawOrders.filter((order) => {
      // 1. Validasi customerUid
      if (order.customerUid !== customerUid) return false;

      // 2. Validasi deviceId: hanya pesanan yang deviceId-nya sama dengan getDeviceId() yang ditampilkan
      const currentDeviceId = getDeviceId();
      if (order.deviceId && order.deviceId !== currentDeviceId) {
        return false;
      }

      // 3. Validasi nomor meja aktif jika nomor meja ditentukan
      if (
        activeTableNumber &&
        String(order.tableNumber).trim() !== String(activeTableNumber).trim()
      ) {
        return false;
      }

      // 4. Pesanan SELESAI atau DIBATALKAN langsung keluar dari daftar aktif
      if (order.status === 'SELESAI' || order.status === 'DIBATALKAN') {
        return false;
      }

      // 5. Pesanan masih aktif (status BARU atau DITERIMA, atau paymentStatus BELUM_BAYAR)
      const isOngoing =
        order.status === 'BARU' ||
        order.status === 'DITERIMA' ||
        order.paymentStatus === 'BELUM_BAYAR';

      return isOngoing;
    });
  }, [rawOrders, customerUid, activeTableNumber]);

  return { orders, rawOrders, loading };
}
