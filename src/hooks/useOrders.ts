import { useState, useEffect, useMemo, useCallback } from 'react';
import { Order } from '../types';
import { orderService } from '../services/orderService';
import { getDateKeyJakarta } from '../lib/formatters';

export function useTodayOrders(customDateKey?: string) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
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
      if (statusFilter === 'ALL') {
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

  // Key metrics: Total, Baru, Diterima, Selesai, Belum Lunas, Tidak Bayar Hari Ini
  const stats = useMemo(() => {
    const total = orders.length;
    const baru = orders.filter((o) => o.status === 'BARU').length;
    const diterima = orders.filter((o) => o.status === 'DITERIMA').length;
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

export function useCustomerOrders(customerUid: string | undefined) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customerUid) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const unsubscribe = orderService.subscribeCustomerOrders(
      customerUid,
      (list) => {
        setOrders(list);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsubscribe();
  }, [customerUid]);

  return { orders, loading };
}
